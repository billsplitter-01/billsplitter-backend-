const axios = require('axios');

async function testRegister() {
    try {
        const res = await axios.post('http://localhost:5000/api/auth/register', {
            name: "Test User",
            email: "testuser" + Math.floor(Math.random() * 1000) + "@example.com",
            password: "password123",
            roomName: "Test Room " + Math.floor(Math.random() * 1000)
        });
        console.log("Success:", res.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

testRegister();
