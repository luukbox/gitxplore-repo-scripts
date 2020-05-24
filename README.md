# JS/TS Repository Scraper

This scraper is part of our IE 684 Web Mining Project: "Mining Node.js Module Dependencies – Analysis of a Dependency Graph & Development of a Dependency Recommender System"

Since some of the code and ideas are based on `appbaseio-apps/gitxplore-repo-scripts`, this repo was created as fork for the sake of transparency.

Usage:

- `$ npm install`

- set `YOUR_API_KEY` variable in fetchFullNames.js to your Github API Key

- `$ node fetchFullNames.js` : queries the Github api and saves the discovered repositories in /full-names under the star range it was found

- `$ node fetchPkgs.js` : traverses all files in /full-names and fetches the package.json (if existant) from Github. Combines the found package.json files and puts them in /pkgs under the starrange the project was found. You can run this command after fetchFullNames.js wrote the first file in full-names. They will run in parallel.

- `$ node merge.js` : merges all files in /pkgs
