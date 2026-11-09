const fs = require('fs');
const path = require('path');

const API_TOKEN = '97473|hbE2FAoJDSgzfzg4TMjhOzbbGm5usTM8WSTZPiqR';
const SNAPSHOT_FILE = path.resolve(__dirname, 'animal_snapshot.json');
const READABLE_REPORT = path.resolve(__dirname, 'all_changes_summary.txt');

function formatUnixToCentral(val) {
    if (!val || isNaN(Number(val))) return val;
    const date = new Date(Number(val) * 1000);
    if (isNaN(date.getTime())) return val;

    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
}

function formatValue(key, val) {
    if (val === null || val === undefined || val === '') return 'None';

    if (key.toLowerCase().includes('unixtime')) {
        return formatUnixToCentral(val);
    }
    
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch (e) { return val; }
    }

    if (typeof val === 'object') {
        if (val.FirstName && val.LastName) return `${val.FirstName} ${val.LastName} (${val.RelationshipType || 'Associated'})`;
        if (val.Tier1 || val.Tier2) return [val.Tier1, val.Tier2, val.Tier3].filter(Boolean).join(' > ');
        if (Array.isArray(val)) {
            return val.map(item => (typeof item === 'object' ? (item.AttributeName || item.Name || item.Id || JSON.stringify(item)) : item)).join(', ');
        }
        return JSON.stringify(val);
    }

    if (key.toLowerCase().includes('weight') && !String(val).includes('lbs')) {
        return `${val}lbs`;
    }

    return String(val);
}

// Universal helper to compare ANY array item-by-item (Attributes, Microchips, etc.)
function compareArrays(key, oldVal, newVal) {
    try {
        const parseArr = (v) => {
            if (!v) return [];
            if (typeof v === 'string') v = JSON.parse(v);
            if (!Array.isArray(v)) return [];
            return v;
        };

        const oldArr = parseArr(oldVal);
        const newArr = parseArr(newVal);

        // Convert items to searchable strings or extract clear labels
        const getItemString = (item) => {
            if (typeof item !== 'object' || item === null) return String(item);
            return item.AttributeName || item.Name || item.Id || item.Number || JSON.stringify(item);
        };

        const oldSet = oldArr.map(getItemString);
        const newSet = newArr.map(getItemString);

        const added = newSet.filter(item => !oldSet.includes(item));
        const removed = oldSet.filter(item => !newSet.includes(item));

        let diffs = [];
        if (added.length > 0) diffs.push(`${key} Added: "${added.join(', ')}"`);
        if (removed.length > 0) diffs.push(`${key} Removed: "${removed.join(', ')}"`);
        return diffs;
    } catch (e) {
        return null; // Fallback if parsing fails
    }
}

async function runFullFieldDiffCheck() {
    try {
        const url = `https://new.shelterluv.com/api/v1/animals?status_type=in%20custody&limit=100&offset=0`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` }
        });
        const data = await response.json();
        if (!data.animals) return;

        let previousState = fs.existsSync(SNAPSHOT_FILE) ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) : {};
        const currentState = {};
        const reportLines = [];
        const skipFields = ['Photos', 'CoverPhoto', 'Videos'];

        data.animals.forEach(animal => {
            const id = animal['Internal-ID'] || animal.ID;
            const name = animal.Name || 'Unknown';
            currentState[id] = animal;

            const oldRecord = previousState[id];
            if (oldRecord) {
                let animalUpdates = [];
                const allKeys = new Set([...Object.keys(animal), ...Object.keys(oldRecord)]);

                allKeys.forEach(key => {
                    if (skipFields.includes(key)) return;

                    const oldValRaw = oldRecord[key];
                    const newValRaw = animal[key];

                    if (JSON.stringify(oldValRaw) !== JSON.stringify(newValRaw)) {
                        
                        // Check if the value is an array (or parsed as an array string)
                        const isArrayField = Array.isArray(oldValRaw) || Array.isArray(newValRaw) || 
                                             (typeof oldValRaw === 'string' && oldValRaw.startsWith('[')) || 
                                             (typeof newValRaw === 'string' && newValRaw.startsWith('['));

                        if (isArrayField) {
                            const arrayDiffs = compareArrays(key, oldValRaw, newValRaw);
                            if (arrayDiffs && arrayDiffs.length > 0) {
                                arrayDiffs.forEach(d => animalUpdates.push(`   - ${d}`));
                            } else {
                                animalUpdates.push(`   - ${key}: "${formatValue(key, oldValRaw)}" -> "${formatValue(key, newValRaw)}"`);
                            }
                        } else {
                            const formattedOld = formatValue(key, oldValRaw);
                            const formattedNew = formatValue(key, newValRaw);
                            animalUpdates.push(`   - ${key}: "${formattedOld}" -> "${formattedNew}"`);
                        }
                    }
                });

                if (animalUpdates.length > 0) {
                    reportLines.push(`🐾 ${name} (ID: ${id})`);
                    reportLines.push(...animalUpdates);
                    reportLines.push('');
                }
            }
        });

        const finalOutput = reportLines.length > 0 
            ? reportLines.join('\n') 
            : 'No field changes recorded across any animal.';

        fs.writeFileSync(READABLE_REPORT, finalOutput);
        fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(currentState, null, 2));
        console.log('Done! All array fields are now tracked cleanly by Added/Removed items.');

    } catch (e) {
        console.error(e);
    }
}

runFullFieldDiffCheck();