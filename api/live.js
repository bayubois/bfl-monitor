import tags from "../channels.json";

const API_KEYS = [
  process.env.YOUTUBE_API_KEY
];

async function fetchWithRotation(urlBase) {

  for (let key of API_KEYS) {

    try {

      const response = await fetch(`${urlBase}&key=${key}`);
      const data = await response.json();

      // Jika quota habis, coba key berikutnya
      if (data.error && data.error.errors) {

        const reason = data.error.errors[0].reason;

        if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
          console.log("Quota exceeded for key, trying next...");
          continue;
        }

      }

      return data;

    } catch (err) {
      continue;
    }

  }

  throw new Error("All API keys failed");
}

export default async function handler(req, res) {

  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate"
  );

  let result = {};

  for (const tag in tags) {
    result[tag] = [];
  }

  try {

    const hashtagList = Object.values(tags);
    const query = hashtagList.join(" OR ");

    const baseURL =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&eventType=live&type=video&maxResults=20`;

    const liveData = await fetchWithRotation(baseURL);

    if (liveData.items) {

      liveData.items.forEach(item => {

        const title = item.snippet.title.toLowerCase();

        for (const tag in tags) {

          const hashtag = tags[tag].toLowerCase();

          if (title.includes(hashtag)) {

            result[tag].push({
              videoId: item.id.videoId,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle
            });

          }

        }

      });

    }

    return res.status(200).json(result);

  } catch (error) {

    console.log("All keys exhausted");
    return res.status(500).json({ error: "All API keys exhausted" });

  }
}
