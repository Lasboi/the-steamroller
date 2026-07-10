/**
 * The Steamroller - Backend Server (v1.0)
 * Main entry point for the Express server handling Steam authentication,
 * API proxy requests to Steam, and session management.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const axios = require('axios');

const app = express();

// Environment variables with fallbacks for local development vs. Coolify deployment
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.COOLIFY_URL || `http://localhost:${PORT}`;

// --- MIDDLEWARE CONFIGURATION ---

// Session configuration
// Required for maintaining persistent login sessions via Passport
app.use(session({
    secret: process.env.SESSION_SECRET || 'steamroller-fallback-secret',
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport and restore authentication state from the session
app.use(passport.initialize());
app.use(passport.session());

// Passport session setup
// Configures the Steam OpenID strategy using the API key
passport.use(new SteamStrategy({
    returnURL: `${DOMAIN}/auth/steam/return`,
    realm: `${DOMAIN}/`,
    apiKey: process.env.STEAM_API_KEY 
  },
  function(identifier, profile, done) {
    return done(null, profile);
  }
));

// Serialize user instance to the session state
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user instance from the session state
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Serve static frontend files (HTML, CSS, JS, Images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// --- AUTHENTICATION ROUTES ---

// Redirect the user to the official Steam login portal
app.get('/auth/steam', passport.authenticate('steam'));

// Steam will redirect the user to this URL after successful approval
app.get('/auth/steam/return', 
    passport.authenticate('steam', { failureRedirect: '/' }),
    function(req, res) {
        // Successful authentication, redirect to the main app interface
        res.redirect('/');
    }
);

// Logout route to safely terminate the active session
app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});


// --- API ROUTES ---

/**
 * GET /api/user
 * Checks current authentication status and returns user data if logged in.
 */
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.json({ error: "Not logged in" });
    }
});

/**
 * GET /api/search-profile
 * Resolves a provided string (Vanity URL, ID64, or full community link)
 * into a valid SteamID64 and fetches basic profile data for the frontend.
 */
app.get('/api/search-profile', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({error: "No input provided"});
    
    const apiKey = process.env.STEAM_API_KEY;
    let steamId = query.trim();

    // Regex to extract identifier if the user provided a full Steam Community link
    const profileMatch = steamId.match(/profiles\/(\d+)/);
    const idMatch = steamId.match(/id\/([^\/]+)/);

    if (profileMatch) {
        // Input is a direct link to a profile with an existing SteamID64
        steamId = profileMatch[1];
    } else if (idMatch) {
        // Input is a link containing a custom Vanity URL, requires API resolution
        try {
            const vanityRes = await axios.get(`http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${idMatch[1]}`);
            if (vanityRes.data.response.success === 1) {
                steamId = vanityRes.data.response.steamid;
            } else {
                return res.json({error: "Couldn't find a Steam profile with that link."});
            }
        } catch (err) {
            return res.json({error: "Couldn't fetch data please try again."});
        }
    } else if (!/^\d{17}$/.test(steamId)) {
        // Input is merely a string (not a 17-digit ID), assume it's a Vanity URL name
        try {
            const vanityRes = await axios.get(`http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${steamId}`);
            if (vanityRes.data.response.success === 1) {
                steamId = vanityRes.data.response.steamid;
            } else {
                return res.json({error: "Invalid input. Please provide a valid 17-digit SteamID or Community link."});
            }
        } catch (err) {
            return res.json({error: "Couldn't fetch data please try again."});
        }
    }

    // Fetch basic profile information to display the "Welcome, [Name]!" message 
    try {
        const summaryRes = await axios.get(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
        const players = summaryRes.data.response.players;
        
        if (!players || players.length === 0) {
            return res.json({error: "Profile not found on Steam."});
        }
        
        const player = players[0];
        
        // Prevent progression if the user's game library visibility is set to Private (3 = Public)
        if (player.communityvisibilitystate !== 3) {
             return res.json({error: "This Steam profile is private! We can't fetch your games."});
        }

        // Return a JSON structure that mimics the standard Passport session object
        res.json({
            id: player.steamid,
            displayName: player.personaname,
            photos: [
                { value: player.avatar }, 
                { value: player.avatarmedium }, 
                { value: player.avatarfull } // Index 2 is utilized by frontend for the large avatar
            ]
        });
    } catch(err) {
        return res.json({error: "Couldn't fetch data please try again."});
    }
});

/**
 * GET /api/games
 * Retrieves the user's owned games from Steam and filters them based on the 
 * requested playtime category. Supports both authorized sessions and manual ID searches.
 */
app.get('/api/games', async (req, res) => {
    let steamId;
    
    // Determine the source of the Steam ID
    if (req.isAuthenticated()) {
        steamId = req.user.id; // Authorized via Passport login
    } else if (req.query.steamid) {
        steamId = req.query.steamid; // Passed manually via the search endpoint
    } else {
        return res.status(401).json({ error: "Not logged in and no Steam ID provided" });
    }

    const apiKey = process.env.STEAM_API_KEY;
    const playtimeFilter = req.query.playtime || 'unplayed';
    
    try {
        // Fetch library; Include App Info (game names, icon hashes) to avoid secondary API calls
        const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;
        const response = await axios.get(url);
        
        if (!response.data.response.games) {
            return res.json({ error: "No games found. Is your 'Game details' set to Public on Steam?" });
        }

        const allGames = response.data.response.games;
        
        // Filter the fetched games array based on the provided playtime constraints
        const filteredGames = allGames.filter(game => {
            if (playtimeFilter === 'unplayed') {
                return game.playtime_forever === 0;
            } else if (playtimeFilter === 'under2') {
                return game.playtime_forever > 0 && game.playtime_forever < 120;
            } else if (playtimeFilter === 'over2') {
                return game.playtime_forever >= 120;
            }
            return true; // Fallback to include everything if filter is unhandled
        });
        
        res.json(filteredGames);

    } catch (error) {
        console.error("Error fetching games:", error.message);
        res.status(500).json({ error: 'Could not fetch games from Steam API' });
    }
});

// --- SERVER INITIALIZATION ---

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running! Live on: ${DOMAIN}`);
});