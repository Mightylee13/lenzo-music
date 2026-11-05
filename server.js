const express = require('express');
const cors = require('cors');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');

const execPromise = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Search Endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Search query required" });

    try {
        const command = `yt-dlp "ytsearch6:${query}" --dump-json --flat-playlist`;
        const { stdout } = await execPromise(command);
        
        const results = stdout.trim().split('\n').map(line => {
            const data = JSON.parse(line);
            return {
                id: data.id,
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[0].url : '',
                url: data.url
            };
        });

        res.json({ results });
    } catch (error) {
        console.error("Search error:", error.message);
        res.status(500).json({ error: "Failed to search. YouTube might be blocking the server." });
    }
});

// Stream Endpoint
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: "Video ID required" });

    try {
        const command = `yt-dlp "https://www.youtube.com/watch?v=${videoId}" -f "ba[ext=m4a]/bestaudio" -g`;
        const { stdout } = await execPromise(command);
        const streamUrl = stdout.trim().split('\n')[0];
        res.json({ streamUrl });
    } catch (error) {
        console.error("Stream error:", error.message);
        res.status(500).json({ error: "Failed to extract stream URL." });
    }
});

app.listen(PORT, () => {
    console.log(`🎵 Lenzo Music running on port ${PORT}`);
});
