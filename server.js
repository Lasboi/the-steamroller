require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.COOLIFY_URL || `http://localhost:${PORT}`;

app.use(session({
    secret: process.env.SESSION_SECRET || 'steamroller-fallback-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new SteamStrategy({
    returnURL: `${DOMAIN}/auth/steam/return`,
    realm: `${DOMAIN}/`,
    apiKey: process.env.STEAM_API_KEY 
  },
  function(identifier, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return', 
    passport.authenticate('steam', { failureRedirect: '/' }),
    function(req, res) {
        res.redirect('/');
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.json({ error: "Not logged in" });
    }
});

// DEN NYE SØGE-RUTE
app.get('/api/search-profile', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({error: "No input provided"});
    const apiKey = process.env.STEAM_API_KEY;

    let steamId = query.trim();

    // Tjekker om de har sat et link ind og klipper det til
    const profileMatch = steamId.match(/profiles\/(\d+)/);
    const idMatch = steamId.match(/id\/([^\/]+)/);

    if (profileMatch) {
        steamId = profileMatch[1];
    } else if (idMatch) {
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
        // Hvis de bare har skrevet et navn uden link
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

    // Henter navn og profilbillede så de stadig får "Welcome, [Navn]!"
    try {
        const summaryRes = await axios.get(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
        const players = summaryRes.data.response.players;
        if (!players || players.length === 0) {
            return res.json({error: "Profile not found on Steam."});
        }
        const player = players[0];
        
        // Stopper brugeren tidligt, hvis deres spil-liste er sat til Privat på Steam
        if (player.communityvisibilitystate !== 3) {
             return res.json({error: "This Steam profile is private! We can't fetch your games."});
        }

        res.json({
            id: player.steamid,
            displayName: player.personaname,
            photos: [
                { value: player.avatar }, 
                { value: player.avatarmedium }, 
                { value: player.avatarfull } // Henter det store billede på plads 2
            ]
        });
    } catch(err) {
        return res.json({error: "Couldn't fetch data please try again."});
    }
});

// OPDATERET SPIL-RUTE (Tillader nu adgang via det manuelle ID)
app.get('/api/games', async (req, res) => {
    let steamId;
    if (req.isAuthenticated()) {
        steamId = req.user.id;
    } else if (req.query.steamid) {
        steamId = req.query.steamid; // Tillader det manuelt fundne ID
    } else {
        return res.status(401).json({ error: "Not logged in and no Steam ID provided" });
    }

    const apiKey = process.env.STEAM_API_KEY;
    const playtimeFilter = req.query.playtime || 'unplayed';
    
    try {
        const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;
        const response = await axios.get(url);
        
        if (!response.data.response.games) {
            return res.json({ error: "No games found. Is your 'Game details' set to Public on Steam?" });
        }

        const allGames = response.data.response.games;
        
        const filteredGames = allGames.filter(game => {
            if (playtimeFilter === 'unplayed') {
                return game.playtime_forever === 0;
            } else if (playtimeFilter === 'under2') {
                return game.playtime_forever > 0 && game.playtime_forever < 120;
            } else if (playtimeFilter === 'over2') {
                return game.playtime_forever >= 120;
            }
            return true;
        });
        
        res.json(filteredGames);

    } catch (error) {
        console.error("Error fetching games:", error.message);
        res.status(500).json({ error: 'Could not fetch games from Steam' });
    }
});

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running! Live on: ${DOMAIN}`);
});