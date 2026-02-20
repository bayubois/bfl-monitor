import channels from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {

  // 🔥 Cache 15 menit (hemat quota besar)
  res.setHeader(
    "Cache-Control",
    "s-maxage=900, stale-while-revalidate"
  );

  let result = {};
  let videoIds = [];
  let videoMap = {};

  try {

    // Loop setiap hashtag
    for (const tag in channels) {

      result[tag] = [];

      for (const channelId of channels[tag]) {

        try {

          // 1️⃣ Ambil uploads playlist channel
          const channelRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
          );

          const channelData = await channelRes.json();

          if (!channelData.items || channelData.items.length === 0) continue;

          const uploadsPlaylist =
            channelData.items[0].contentDetails.relatedPlaylists.uploads;

          // 2️⃣ Ambil 1 video terbaru dari channel
          const playlistRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=1&key=${API_KEY}`
          );

          const playlistData = await playlistRes.json();

          if (!playlistData.items || playlistData.items.length === 0) continue;

          const latestVideoId =
            playlistData.items[0].snippet.resourceId.videoId;

          videoIds.push(latestVideoId);

          videoMap[latestVideoId] = {
            tag,
            title: playlistData.items[0].snippet.title,
            channelTitle: playlistData.items[0].snippet.channelTitle
          };

        } catch (err) {
          console.log("Channel error:", channelId);
        }
      }
    }

    // 3️⃣ Bulk check live status (hemat quota)
    if (videoIds.length > 0) {

      const liveRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoIds.join(",")}&key=${API_KEY}`
      );

      const liveData = await liveRes.json();

      if (liveData.items) {

        liveData.items.forEach(video => {

          // 🔥 FILTER FINAL YANG BENAR
          if (
            video.liveStreamingDetails &&
            video.liveStreamingDetails.actualStartTime &&
            !video.liveStreamingDetails.actualEndTime
          ) {

            const info = videoMap[video.id];

            if (info) {
              result[info.tag].push({
                videoId: video.id,
                title: info.title,
                channelTitle: info.channelTitle
              });
            }
          }

        });
      }
    }

    return res.status(200).json(result);

  } catch (error) {

    console.log("API ERROR:", error);
    return res.status(500).json({ error: "Server error" });

  }
}
