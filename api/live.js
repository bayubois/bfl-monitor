export default async function handler(req, res) {

  const API_KEY = process.env.YOUTUBE_API_KEY;
  const HASHTAGS = ["bfl", "nakamamc"];

  try {

    const query = HASHTAGS.join(" OR ");

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&maxResults=25&q=${encodeURIComponent(query)}&regionCode=ID&relevanceLanguage=id&key=${API_KEY}`
    );

    const data = await response.json();

    if (!data.items) {
      res.setHeader(
        "Cache-Control",
        "s-maxage=60, stale-while-revalidate=120"
      );
      return res.status(200).json({});
    }

    let categorized = {};
    HASHTAGS.forEach(tag => categorized[tag] = []);

    data.items.forEach(item => {
      const title = item.snippet.title.toLowerCase();
      const desc = item.snippet.description.toLowerCase();

      HASHTAGS.forEach(tag => {
        if (title.includes("#" + tag) || desc.includes("#" + tag)) {
          categorized[tag].push({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle
          });
        }
      });
    });

    // 🔥 EDGE CACHE HEADER
    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=120"
    );

    return res.status(200).json(categorized);

  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch live data" });
  }
}
