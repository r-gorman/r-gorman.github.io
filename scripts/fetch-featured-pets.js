const fs = require('fs');
const path = require('path');

// Dynamically target project-root/content/home
const targetDir = path.resolve(__dirname, '../content/home');

async function updateFeaturedPets() {
    try {
        const response = await fetch('https://new.shelterluv.com/api/v1/animals?status_type=in%20custody&sort=updated_at&since=1672531199&limit=100&offset=0', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer 97473|hbE2FAoJDSgzfzg4TMjhOzbbGm5usTM8WSTZPiqR',
                'User-Agent': 'PostmanRuntime/7.36.1',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });

        const textData = await response.text();
        const data = JSON.parse(textData);
        
        if (data.success !== 1 || !data.animals || data.animals.length === 0) {
            console.error('API Error or no animals found.');
            return;
        }

        // Filter for available/adoptable animals
        const availableAnimals = data.animals.filter(pet => {
            const status = (pet.Status || '').toLowerCase();
            return status.includes('available');
        });

        // Check specifically for available cats using 'Type'
        const availableCats = availableAnimals.filter(pet => {
            const type = (pet.Type || '').toLowerCase();
            return type === 'cat' || type === 'feline';
        });

        // Ensure root/content/home exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Save site-status.json to root/content/home/site-status.json
        const siteStatus = { cats_available: availableCats.length > 0 };
        fs.writeFileSync(path.join(targetDir, 'site-status.json'), JSON.stringify(siteStatus, null, 2));
        console.log(`Available cats count: ${availableCats.length}`);

        if (availableAnimals.length === 0) {
            console.log('No available animals found.');
            return;
        }

        // Randomize and select 2 pets for featured section
        const shuffled = availableAnimals.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);

        const featuredData = selected.map(pet => {
            const uniqueId = pet['Internal-ID'] || pet.ID;
            return {
                name: pet.Name,
                image: pet.Photos && pet.Photos.length > 0 ? pet.Photos[0] : 'images/logo.png',
                text: pet.Description ? pet.Description.replace(/<[^>]*>?/gm, '').substring(0, 120) + '...' : 'Looking for my forever home!',
                link: `https://www.shelterluv.com/embed/animal/${uniqueId}`
            };
        });

        // Save featured-pets.json to root/content/home/featured-pets.json
        fs.writeFileSync(path.join(targetDir, 'featured-pets.json'), JSON.stringify(featuredData, null, 2));
        console.log('Successfully updated featured-pets.json and site-status.json in root/content/home/');

    } catch (error) {
        console.error('API Request Error:', error);
    }
}

updateFeaturedPets();