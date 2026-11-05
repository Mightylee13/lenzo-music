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

// Search Endpoint (YouTube)
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Search query required" });

    try {
        const command = `yt-dlp "ytsearch6:${query}" --dump-json --flat-playlist --js-runtimes node`;
        const { stdout } = await execPromise(command);
        
        const results = stdout.trim().split('\n').map(line => {
            const data = JSON.parse(line);
            return {
                id: data.id,
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[0].url : '',
                url: data.url,
                source: 'YouTube'
            };
        });

        res.json({ results });
    } catch (error) {
        console.error("Search error:", error.message);
        res.status(500).json({ error: "Failed to search. YouTube might be blocking the server." });
    }
});

// Stream Endpoint (YouTube with Audiomack Fallback)
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    const title = req.query.title || videoId; // Get the title passed from frontend
    
    if (!videoId) return res.status(400).json({ error: "Video ID required" });

    try {
        // 1. Try YouTube first
        try {
            const ytCmd = `yt-dlp "https://www.youtube.com/watch?v=${videoId}" -f "ba[ext=m4a]/bestaudio" -g --js-runtimes node`;
            const { stdout } = await execPromise(ytCmd);
            const streamUrl = stdout.trim().split('\n')[0];
            return res.json({ streamUrl, source: 'YouTube' });
        } catch (ytError) {
            console.log("YouTube blocked, switching to Audiomack...");
        }

        // 2. Fallback to Audiomack
        const searchCmd = `yt-dlp "https://audiomack.com/search?q=${encodeURIComponent(title)}" --dump-json --flat-playlist --js-runtimes node`;
        const { stdout: searchOut } = await execPromise(searchCmd);
        const searchResults = searchOut.trim().split('\n').map(line => JSON.parse(line));
        
        if (searchResults.length === 0) throw new Error("Song not found on Audiomack");

        const audiomackUrl = searchResults[0].url;
        
        // Extract the stream URL from Audiomack
        const amCmd = `yt-dlp "${audiomackUrl}" -f "bestaudio" -g --js-runtimes node`;
        const { stdout: amStreamOut } = await execPromise(amCmd);
        const amStreamUrl = amStreamOut.trim().split('\n')[0];

        res.json({ streamUrl: amStreamUrl, source: 'Audiomack' });

    } catch (error) {
        console.error("Stream error:", error.message);
        res.status(500).json({ error: "Failed to extract stream URL from YouTube or Audiomack." });
    }
});

app.listen(PORT, () => {
    console.log(`🎵 Lenzo Music running on port ${PORT}`);
});
