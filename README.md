<div align="center">
<img src="public/logo.png" alt="The Steamroller Logo" width="200"/>
<h1>🚜 The Steamroller</h1>
<p><strong>Turn your endless Steam backlog into a game of roulette.</strong></p>

<p>
<a href="#features">Features</a> •
<a href="#demo">Demo</a> •
<a href="#tech-stack">Tech Stack</a> •
<a href="#installation">Installation</a> •
<a href="#how-it-works">How it Works</a>
</p>
</div>

🎮 What is The Steamroller?
Gamers everywhere suffer from the same modern dilemma: having hundreds of games in their Steam library but absolutely no idea what to play. The Steamroller solves this by gamifying your backlog.

Whether you securely log in with your Steam account or manually search a Steam profile, the app fetches your game library, filters it based on your playtime preferences, and loads the qualifying games into a CS:GO-style roulette case. Hit spin, enjoy the suspense, and let fate decide your next adventure!

✨ Features
🔒 Secure Steam Authentication: Log in seamlessly using the official Steam OpenID provider via Passport.js.

🔍 Manual Profile Search: Don't want to log in? Search any public profile using a 17-digit SteamID64, a Custom Vanity URL, or a direct Community Link.

⏱️ Playtime Filters: Narrow down your roulette pool by selecting:

Unplayed (0 hrs) - Perfect for tackling the backlog.

Under 2 hrs - Give those abandoned games a second chance.

Over 2 hrs - Revisit old favorites.

🎰 Epic Roulette Mechanics: A fully custom, physics-based CS:GO-style case opening animation complete with authentic audio and a confetti celebration.

🚀 One-Click Launch: Once a winner is chosen, click the launch button to immediately boot up or install the game directly through the Steam client (using the steam:// protocol).

📱 Fully Responsive Design: Looks and feels like a premium native app whether you are on a 4K desktop monitor or a smartphone.

✨ Nostalgic Easter Eggs: Features classic Old School RuneScape (OSRS) text animation effects (wave, flash, glow, shake) to bring that retro gaming feel to a modern UI.

📸 Demo & Screenshots

<p>Try it yourself at <a href="https://steamroller.lasboi.com/" target="_blank">https://steamroller.lasboi.com/</a></p>

<div align="center">
<img src="https://steamroller.lasboi.com/the-steamroller.png" alt="Steamroller Demo" />
</div>

🛠️ Tech Stack
Frontend:

HTML5 & CSS3 (Custom responsive Flexbox/Grid layout)

Vanilla JavaScript (DOM manipulation, fetching, and animation math)

Canvas Confetti (For the winning celebration)

FontAwesome (Icons)

Backend:

Node.js & Express.js (Web Server & API routing)

Axios (For direct Steam Web API requests)

Passport.js & passport-steam (Authentication strategy)

express-session (Session management)

🚀 Installation & Local Setup
Want to run The Steamroller locally? Follow these steps:

1. Prerequisites
Node.js installed on your machine.

A Steam API Key. You can get one for free at Steam Community Dev.

2. Clone the Repository
Bash
git clone [https://github.com/YourUsername/the-steamroller.git](https://github.com/YourUsername/the-steamroller.git)
cd the-steamroller
3. Install Dependencies
Bash
npm install
4. Configure Environment Variables
Create a .env file in the root directory of the project and add the following variables:

Kodestykke
# Your secret Steam Web API Key
STEAM_API_KEY=your_steam_api_key_here

# A random string used to encrypt the session data
SESSION_SECRET=a_super_secret_string_make_it_random

# The port you want the server to run on (Default is 3000)
PORT=3000

# Your local or production domain (Required for Steam OAuth redirect)
COOLIFY_URL=http://localhost:3000
5. Start the Server
Bash
node server.js
The app will now be running at http://localhost:3000.

🧠 How It Works (Under the Hood)
Fetching the Library: When a user logs in or searches an ID, the backend communicates with the IPlayerService/GetOwnedGames Steam API endpoint, fetching the user's entire library along with appinfo (game titles and icon hashes).

Filtering: The backend filters out games that do not match the user's selected playtime criteria. Note: The user's Steam Game Details privacy setting must be set to "Public" for this to work.

The Spin Logic: The frontend takes the filtered array of games, randomly selects 80 of them, and constructs a visual DOM track. A pre-determined "winning index" (Index 64) is chosen, and the CSS transform: translateX property is calculated dynamically to slide the track exactly to that card, applying a cubic-bezier timing function for realistic deceleration.

<div align="center">
<p>Made with ❤️ by <a href="https://steamcommunity.com/id/LasBoi/" target="_blank">LasBoi</a></p>
</div>
