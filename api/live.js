import tags from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {

  // 🔥 Cache 1 jam
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate"
  );

  let result = {};

  // Inisialisasi hasil
  for (const tag in tags) {
    result[tag] = [];
  }

  try {

    // 🔥 Gabungkan semua hashtag dalam 1 query
    const hashtagList = Object.values(tags);
    const query = hashtagList.join(" OR ");

    const liveRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&eventType=live&type=video&maxResults=20&key=${API_KEY}`
    );

    const liveData = await liveRes.json();

    if (liveData.items && liveData.items.length > 0) {

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

    console.log("API ERROR:", error);
    return res.status(500).json({ error: "Server error" });

  }

}
