const fetch = require("node-fetch");
const fs = require("fs");

const YOUR_API_KEY = "";

const headers = {
  Authorization: `token ${YOUR_API_KEY}`,
  Accept: "application/vnd.github.v3+json",
};

const constructApi = (start, end, page, lang) =>
  `https://api.github.com/search/repositories?q=in:package.json+language:${lang}+stars:${start}..${end}&per_page=100&page=${page}&sort=updated&order=desc`;

const buildEndpoints = (startIncluding, stopExcluding, step) => {
  const ranges = [];
  for (let i = startIncluding; i < stopExcluding; i = i + step) {
    ranges.push({ start: i, end: i + step - 1 });
  }
  return ranges;
};

let endpoints = [];

endpoints = endpoints.concat(buildEndpoints(0, 10, 1));
endpoints = endpoints.concat(buildEndpoints(10, 100, 5));
endpoints = endpoints.concat(buildEndpoints(100, 1000, 10));
endpoints = endpoints.concat(buildEndpoints(1000, 10000, 100));
endpoints = endpoints.concat(buildEndpoints(10000, 100000, 1000));
endpoints.push({ start: 100000, end: 500000 });

function altThrottle(f, calls, milliseconds) {
  const queue = [];
  const complete = [];
  let inflight = 0;

  const processQueue = function () {
    // Remove old complete entries.
    const now = Date.now();
    while (complete.length && complete[0] <= now - milliseconds)
      complete.shift();

    // Make calls from the queue that fit within the limit.
    while (queue.length && complete.length + inflight < calls) {
      const request = queue.shift();
      ++inflight;

      // Call the deferred function, fulfilling the wrapper Promise
      // with whatever results and logging the completion time.
      const p = f.apply(request.this, request.arguments);
      Promise.resolve(p)
        .then(
          (result) => {
            request.resolve(result);
          },
          (error) => {
            request.reject(error);
          }
        )
        .then(() => {
          --inflight;
          complete.push(Date.now());

          if (queue.length && complete.length === 1)
            setTimeout(processQueue, milliseconds);
        });
    }

    // Check the queue on the next expiration.
    if (queue.length && complete.length)
      setTimeout(processQueue, complete[0] + milliseconds - now);
  };

  return function () {
    return new Promise((resolve, reject) => {
      queue.push({
        this: this,
        arguments: arguments,
        resolve: resolve,
        reject: reject,
      });

      processQueue();
    });
  };
}

const altFetch = altThrottle(fetch, 1, 2000); // 1 call per 2 sec => 30 calls per min

const getRepos = async (start, end, page, lang) => {
  const api = constructApi(start, end, page, lang);
  const data = await altFetch(api, { method: "GET", headers: headers })
    .then((res) => res.json())
    .then((json) => {
      if (!json.items || json.items.length === 0) {
        console.log(json);
      }
      return json.items;
    })
    .catch((err) => console.error("err", err));
  //   console.log(`got ${data.length} results for ${start} to ${end} and page ${page}`);
  if (!data || data.length === 0) {
    console.log(`no more results for page ${page}`);
    return [];
  } else {
    if (page !== 10) {
      console.log(`more results available going to page ${page + 1}`);
      const nextData = await getRepos(start, end, page + 1, lang).then(
        (data) => data
      );
      console.log(
        `returning ${nextData.length} page results for page ${page + 1}`
      );
      return data.concat(nextData);
    } else {
      return data;
    }
  }
};

(async function () {
  const langs = ["JavaScript", "TypeScript"];
  for (let i = 0; i < endpoints.length; i += 1) {
    const fullNames = [];

    for (let lang of langs) {
      console.log(
        `starting for ${lang} ${endpoints[i].start} to ${endpoints[i].end}`
      );

      const repos = await getRepos(
        endpoints[i].start,
        endpoints[i].end,
        1,
        lang
      );
      fullNames.push(...repos.map((r) => r.full_name));
    }

    console.log(
      `writing total of ${fullNames.length} results for full-names: ${endpoints[i].start}_${endpoints[i].end}.json`
    );
    fs.writeFileSync(
      `./full-names/${endpoints[i].start}_${endpoints[i].end}.json`,
      JSON.stringify(fullNames)
    );
  }
})();
