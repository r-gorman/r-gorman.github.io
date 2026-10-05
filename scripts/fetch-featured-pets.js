const fs = require('fs');
const https = require('https');

const apiKey = process.env.SHELTERLUV_API_KEY;
if (!apiKey) {
    console.error('Error: SHELTERLUV_API_KEY environment variable is missing.');
    process.exit(1);
}

const options = {
    hostname: 'www.shelterluv.com',
    path: '/api/v1/animals', 
    method: 'GET',
    headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            const animals = response.Animals || response; 

            // Filter for only available/adoptable animals
            const availableAnimals = animals.filter(pet => {
                const status = (pet.Status || '').toLowerCase();
                return status.includes('available') || status.includes('adoptable');
            });

            if (availableAnimals.length === 0) {
                console.log('No available animals found.');
                return;
            }

            // Shuffle and pick 2 random animals
            const shuffled = availableAnimals.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 2);

            // Format them for your homepage layout with direct links
            const featuredData = selected.map(pet => ({
                name: pet.Name,
                image: pet.Photos && pet.Photos.length > 0 ? pet.Photos[0] : 'images/logo.png',
                text: pet.Description ? pet.Description.replace(/<[^>]*>?/gm, '').substring(0, 120) + '...' : 'Looking for my forever home!',
                link: `adopt.html#${pet.ID || pet.Name.toLowerCase().replace(/\s+/g, '-')}` 
            }));

            // Ensure the directory exists before writing
            if (!fs.existsSync('content/home')) {
                fs.mkdirSync('content/home', { recursive: true });
            }

            // Save to a json file that index.html can read
            fs.writeFileSync('content/home/featured-pets.json', JSON.stringify(featuredData, null, 2));
            console.log('Successfully updated featured-pets.json with 2 random animals.');

        } catch (e) {
            console.error('Error parsing Shelterluv API response:', e);
        }
    });
});

req.on('error', (error) => {
    console.error('API Request Error:', error);
    process.exit(1);
});

req.end();
