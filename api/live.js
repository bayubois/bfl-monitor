import channels from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

// ===== CONFIG =====
const NORMAL_SCAN_SIZE = 5;
const HOT_SCAN_SIZE = 9999; // scan semua
const MEMORY_CACHE_TIME = 10 * 60 * 1000; // 10 menit
// ===================

let cachedData = {};
let lastFetchTime = 0;
let channelIndex = 0;
let hotMode = false;

export default async function handler(req, res) {

  res.setHeader(
    "Cache-Control",
    "s-maxage=600, stale-while-revalidate"
  );

  const now = Date.now();

  if (now - lastFetchTime < MEMORY_CACHE_TIME) {
    return res.status(200).json(cachedData);
  }

  try {

    let result = {};
    let videoIds = [];
    let videoMap = {};

    for (const tag in channels) {
      result[tag] = [];
    }

    const allChannels = Object.values(channels).flat();

    const scanSize = hotMode ? HOT_SCAN_SIZE : NORMAL_SCAN_SIZE;

    const slice = allChannels.slice(
      channelIndex,
      channelIndex + scanSize
    );

    for (const channelId of slice) {

      const uploadsPlaylist = channelId.replace(/^UC/, "UU");

      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=1&key=${API_KEY}`
      );

      const playlistData = await playlistRes.json();
      if (!playlistData.items?.length) continue;

      const latestVideoId =
        playlistData.items[0].snippet.resourceId.videoId;

      videoIds.push(latestVideoId);

      const tag = Object.keys(channels)
        .find(t => channels[t].includes(channelId));

      videoMap[latestVideoId] = {
        tag,
        title: playlistData.items[0].snippet.title,
        channelTitle: playlistData.items[0].snippet.channelTitle
      };

    }

    channelIndex += scanSize;
    if (channelIndex >= allChannels.length) {
      channelIndex = 0;
    }

    if (videoIds.length > 0) {

      const liveRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoIds.join(",")}&key=${API_KEY}`
      );

      const liveData = await liveRes.json();

      let hasLive = false;

      if (liveData.items) {

        liveData.items.forEach(video => {

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

              hasLive = true;
            }

          }

        });

      }

      // 🔥 Aktifkan hot mode kalau ada live
      hotMode = hasLive;

    }

    cachedData = result;
    lastFetchTime = now;

    return res.status(200).json(result);

  } catch (error) {
    console.log("API ERROR:", error);
    return res.status(200).json(cachedData || {});
  }

}
