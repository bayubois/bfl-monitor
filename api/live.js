import channels from "../channels.json";

const API_KEY = process.env.YOUTUBE_API_KEY;

/*
  CONFIG
*/
const SCAN_SIZE = 23;                    // berapa channel non-live dicek per cycle
const MEMORY_CACHE_TIME = 10 * 60 * 1000; // 10 menit

/*
  MEMORY STATE
*/
let cachedData = {};
let lastFetchTime = 0;
let channelIndex = 0;
let activeLives = {}; // { channelId: videoId }

export default async function handler(req, res) {

  // Edge cache 10 menit
  res.setHeader(
    "Cache-Control",
    "s-maxage=600, stale-while-revalidate"
  );

  const now = Date.now();

  // ===== SERVE MEMORY CACHE =====
  if (now - lastFetchTime < MEMORY_CACHE_TIME) {
    return res.status(200).json(cachedData);
  }

  try {

    let result = {};
    let videoIds = [];
    let videoMap = {};

    // Inisialisasi kategori
    for (const tag in channels) {
      result[tag] = [];
    }

    const allChannels = Object.values(channels).flat();

    // ===== CHANNEL YANG BELUM LIVE =====
    const nonLiveChannels = allChannels.filter(
      id => !activeLives[id]
    );

    const slice = nonLiveChannels.slice(
      channelIndex,
      channelIndex + SCAN_SIZE
    );

    // ===== SCAN CHANNEL BARU (PLAYLIST CHECK) =====
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
        channelId,
        title: playlistData.items[0].snippet.title,
        channelTitle: playlistData.items[0].snippet.channelTitle
      };
    }

    // Geser index rolling
    channelIndex += SCAN_SIZE;
    if (channelIndex >= nonLiveChannels.length) {
      channelIndex = 0;
    }

    // ===== TAMBAHKAN CHANNEL YANG SUDAH LIVE =====
    Object.entries(activeLives).forEach(([channelId, videoId]) => {

      videoIds.push(videoId);

      const tag = Object.keys(channels)
        .find(t => channels[t].includes(channelId));

      videoMap[videoId] = {
        tag,
        channelId,
        title: "",
        channelTitle: ""
      };

    });

    // ===== BULK LIVE CHECK (1 QUOTA) =====
    if (videoIds.length > 0) {

      const liveRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoIds.join(",")}&key=${API_KEY}`
      );

      const liveData = await liveRes.json();

      let newActiveLives = {};

      if (liveData.items) {

        liveData.items.forEach(video => {

          if (
            video.liveStreamingDetails &&
            video.liveStreamingDetails.actualStartTime &&
            !video.liveStreamingDetails.actualEndTime
          ) {

            const info = videoMap[video.id];
            if (!info) return;

            result[info.tag].push({
              videoId: video.id,
              title: video.snippet.title,
              channelTitle: video.snippet.channelTitle
            });

            newActiveLives[info.channelId] = video.id;
          }

        });

      }

      // Update daftar live aktif
      activeLives = newActiveLives;
    }

    cachedData = result;
    lastFetchTime = now;

    return res.status(200).json(result);

  } catch (error) {

    console.log("API ERROR:", error);

    // fallback ke cache lama kalau error
    return res.status(200).json(cachedData || {});
  }

}
