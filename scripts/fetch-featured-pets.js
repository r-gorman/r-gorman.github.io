const fs = require('fs');

async function updateFeaturedPets() {
    try {
        // Pull token from environment variable (GitHub Secret or local env)
        const bearerToken = process.env.SHELTERLUV_API_KEY;

        if (!bearerToken) {
            console.error('Error: SHELTERLUV_API_KEY environment variable is missing.');
            process.exit(1);
        }

        const response = await fetch('https://new.shelterluv.com/api/v1/animals?status_type=in%20custody&sort=updated_at&since=1672531199&limit=100&offset=0', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': bearerToken,
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
            return status.includes('available') || status.includes('adoptable');
        });

        if (availableAnimals.length === 0) {
            console.log('No available animals found.');
            return;
        }

        // Randomize and select 2 pets
        const shuffled = availableAnimals.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);

        // Map data fields using Internal-ID for profile URLs
        const featuredData = selected.map(pet => {
            const uniqueId = pet['Internal-ID'] || pet.ID;
            return {
                name: pet.Name,
                image: pet.Photos && pet.Photos.length > 0 ? pet.Photos[0] : 'images/logo.png',
                text: pet.Description ? pet.Description.replace(/<[^>]*>?/gm, '').substring(0, 120) + '...' : 'Looking for my forever home!',
                link: `https://www.shelterluv.com/embed/animal/${uniqueId}`
            };
        });

        if (!fs.existsSync('content/home')) {
            fs.mkdirSync('content/home', { recursive: true });
        }

        fs.writeFileSync('content/home/featured-pets.json', JSON.stringify(featuredData, null, 2));
        console.log('Successfully updated featured-pets.json securely.');

    } catch (error) {
        console.error('API Request Error:', error);
    }
}

updateFeaturedPets();
