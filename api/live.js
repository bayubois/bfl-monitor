import tags from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {

  // 🔥 Cache 1 JAM (hemat quota besar)
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate"
  );

  let result = {};

  try {

    for (const tag in tags) {

      result[tag] = [];

      const hashtag = tags[tag];

      try {

        // 🔥 ULTRA HEMAT — 1 REQUEST PER HASHTAG
        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(hashtag)}&eventType=live&type=video&maxResults=10&key=${API_KEY}`
        );

        const liveData = await liveRes.json();

        if (liveData.items && liveData.items.length > 0) {

          liveData.items.forEach(item => {

            const title = item.snippet.title.toLowerCase();

            // 🔥 FILTER TAMBAHAN: judul harus benar-benar mengandung hashtag
            if (title.includes(hashtag.toLowerCase())) {

              result[tag].push({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle
              });

            }

          });

        }

      } catch (err) {
        console.log("Hashtag error:", tag);
      }

    }

    return res.status(200).json(result);

  } catch (error) {

    console.log("API ERROR:", error);
    return res.status(500).json({ error: "Server error" });

  }

}
