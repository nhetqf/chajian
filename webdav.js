"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_1 = require("webdav");

let cachedData = {};

// 获取 WebDAV 客户端
function getClient() {
    var _a, _b, _c;
    const { url, username, password, searchPath } = (_b = (_a = env === null || env === void 0 ? void 0 : env.getUserVariables) === null || _a === void 0 ? void 0 : _a.call(env)) !== null && _b !== void 0 ? _b : {};
    if (!(url && username && password)) {
        return null;
    }
    if (!(cachedData.url === url &&
        cachedData.username === username &&
        cachedData.password === password &&
        cachedData.searchPath === searchPath)) {
        cachedData.url = url;
        cachedData.username = username;
        cachedData.password = password;
        cachedData.searchPath = searchPath;
        cachedData.searchPathList = (_c = searchPath === null || searchPath === void 0 ? void 0 : searchPath.split) === null || _c === void 0 ? void 0 : _c.call(searchPath, ",");
        cachedData.cacheFileList = null;
    }
    return (0, webdav_1.createClient)(url, {
        authType: webdav_1.AuthType.Password,
        username,
        password,
    });
}

// 解析文件名，提取歌手、歌曲名和专辑名
function parseFileName(filename) {
    const parts = filename.split(" - "); // 假设文件名格式为 "歌手 - 歌曲名 - 专辑名.mp3"
    if (parts.length === 3) {
        return {
            artist: parts[0].trim(),
            title: parts[1].trim(),
            album: parts[2].replace(/\.[^/.]+$/, "").trim(), // 去掉文件扩展名
        };
    }
    return {
        artist: "未知歌手",
        title: filename.replace(/\.[^/.]+$/, "").trim(), // 去掉文件扩展名
        album: "默认专辑",
    };
}

// 获取封面文件的 URL
function getCoverUrl(filename, client) {
    const baseName = filename.replace(/\.[^/.]+$/, ""); // 去掉文件扩展名
    const coverExtensions = [".jpg", ".png"];
    for (const ext of coverExtensions) {
        const coverPath = `${baseName}${ext}`;
        if (cachedData.cacheFileList?.some((it) => it.filename === coverPath)) {
            return client.getFileDownloadLink(coverPath);
        }
    }
    return null; // 如果没有找到封面，返回 null
}

// 获取歌词文件的 URL
function getLyricUrl(filename, client) {
    const baseName = filename.replace(/\.[^/.]+$/, ""); // 去掉文件扩展名
    const lyricPath = `${baseName}.lrc`;
    if (cachedData.cacheFileList?.some((it) => it.filename === lyricPath)) {
        return client.getFileDownloadLink(lyricPath);
    }
    return null; // 如果没有找到歌词，返回 null
}

// 搜索音乐
async function searchMusic(query) {
    var _a, _b;
    const client = getClient();
    if (!cachedData.cacheFileList) {
        const searchPathList = ((_a = cachedData.searchPathList) === null || _a === void 0 ? void 0 : _a.length)
            ? cachedData.searchPathList
            : ["/"];
        let result = [];
        for (let search of searchPathList) {
            try {
                const fileItems = (await client.getDirectoryContents(search)).filter((it) => it.type === "file" && it.mime.startsWith("audio"));
                result = [...result, ...fileItems];
            }
            catch (_c) { }
        }
        cachedData.cacheFileList = result;
    }
    return {
        isEnd: true,
        data: ((_b = cachedData.cacheFileList) !== null && _b !== void 0 ? _b : [])
            .filter((it) => it.basename.includes(query))
            .map((it) => {
                const { artist, title, album } = parseFileName(it.basename);
                return {
                    title,
                    id: it.filename,
                    artist,
                    album,
                    cover: getCoverUrl(it.filename, client),
                    lyric: getLyricUrl(it.filename, client),
                };
            }),
    };
}

// 获取排行榜
async function getTopLists() {
    getClient();
    const data = {
        title: "全部歌曲",
        data: (cachedData.searchPathList || []).map((it) => ({
            title: it,
            id: it,
        })),
    };
    return [data];
}

// 获取排行榜详情
async function getTopListDetail(topListItem) {
    const client = getClient();
    const fileItems = (await client.getDirectoryContents(topListItem.id)).filter((it) => it.type === "file" && it.mime.startsWith("audio"));
    return {
        musicList: fileItems.map((it) => {
            const { artist, title, album } = parseFileName(it.basename);
            return {
                title,
                id: it.filename,
                artist,
                album,
                cover: getCoverUrl(it.filename, client),
                lyric: getLyricUrl(it.filename, client),
            };
        }),
    };
}

// 获取音乐文件的播放链接
async function getMediaSource(musicItem) {
    const client = getClient();
    return {
        url: client.getFileDownloadLink(musicItem.id),
    };
}

// 插件导出
module.exports = {
    platform: "WebDAV",
    author: "猫头猫",
    description: "使用此插件前先配置用户变量",
    userVariables: [
        {
            key: "url",
            name: "WebDAV地址",
        },
        {
            key: "username",
            name: "用户名",
        },
        {
            key: "password",
            name: "密码",
            type: "password",
        },
        {
            key: "searchPath",
            name: "存放歌曲的路径",
        },
    ],
    version: "0.0.2",
    supportedSearchType: ["music"],
    srcUrl: "https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/webdav/index.js",
    cacheControl: "no-cache",
    search(query, page, type) {
        if (type === "music") {
            return searchMusic(query);
        }
    },
    getTopLists,
    getTopListDetail,
    getMediaSource,
};
