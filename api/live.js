import channels from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {

  // Cache 10 menit
  res.setHeader(
    "Cache-Control",
    "s-maxage=600, stale-while-revalidate"
  );

  let result = {};

  try {

    for (const tag in channels) {

      result[tag] = [];

      for (const channelId of channels[tag]) {

        try {

          // 🔥 LANGSUNG CARI LIVE AKTIF
          const liveRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
          );

          const liveData = await liveRes.json();

          if (liveData.items && liveData.items.length > 0) {

            liveData.items.forEach(item => {

              result[tag].push({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle
              });

            });

          }

        } catch (err) {
          console.log("Channel error:", channelId);
        }

      }

    }

    return res.status(200).json(result);

  } catch (error) {

    console.log("API ERROR:", error);
    return res.status(500).json({ error: "Server error" });

  }

}
