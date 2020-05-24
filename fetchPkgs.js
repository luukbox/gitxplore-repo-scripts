const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const headers = {
  Authorization: "token 8710adbe7f417b7c63e28c52b3595bb389210947",
};

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

const altFetchPackageJson = altThrottle(fetch, 1, 100); // 1 call per .2 sec => 300 calls per min

const getPackageJson = async (fullName, context) => {
  if (!fullName) {
    return;
  }
  const packageJsonUrl = `https://raw.githubusercontent.com/${fullName}/master/package.json`;
  console.log(`[${context}] fetching ${packageJsonUrl} ...`);
  try {
    const pkgResp = await altFetchPackageJson(packageJsonUrl, {
      method: "GET",
      headers: headers,
    });
    const json = await pkgResp.json();
    return json;
  } catch {
    return undefined;
  }
};

const getPackageJsons = async (fullNames, context) => {
  console.log(`fetching ${fullNames.length} package.json files...`);
  const pkgs = {};
  let i = 0;
  for (let name of fullNames) {
    i++;
    pkgs[name] = await getPackageJson(
      name,
      `(${i}/${fullNames.length}) ${context}`
    );
  }
  return pkgs;
};

async function run() {
  while (true) {
    const filesDone = fs.readdirSync(path.join(__dirname, "pkgs"));
    const filesTodo = fs
      .readdirSync(path.join(__dirname, "full-names"))
      .filter((td) => !filesDone.includes(td));

    if (filesTodo.length === 0) {
      console.log("DONE");
      break;
    }

    const fileName = filesTodo[0];
    const filePath = path.join(__dirname, "full-names", fileName);
    const fullNames = require(filePath);
    const pkgs = await getPackageJsons(fullNames, fileName);

    console.log(
      `writing total of ${Object.keys(pkgs).length} pkgs for ${fileName}`
    );
    fs.writeFileSync(`./pkgs/${fileName}`, JSON.stringify(pkgs, null, 2));
  }
}

run();
