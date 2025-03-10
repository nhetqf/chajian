"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_1 = require("webdav");

// 缓存数据
let cachedData = {};

// 获取 WebDAV 客户端
function getClient() {
    const { url, username, password, searchPath } = env.getUserVariables() || {};
    if (!url || !username || !password) {
        throw new Error("请配置 WebDAV 的用户变量（url、username、password）。");
    }

    // 如果配置发生变化，清空缓存
    if (
        cachedData.url !== url ||
        cachedData.username !== username ||
        cachedData.password !== password ||
        cachedData.searchPath !== searchPath
    ) {
        cachedData = {
            url,
            username,
            password,
            searchPath,
            searchPathList: searchPath ? searchPath.split(",") : ["/"],
            cacheFileList: null,
        };
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
    const client = getClient();
    if (!cachedData.cacheFileList) {
        const searchPathList = cachedData.searchPathList || ["/"];
        let result = [];
        for (const search of searchPathList) {
            try {
                const fileItems = (await client.getDirectoryContents(search)).filter(
                    (it) => it.type === "file" && it.mime.startsWith("audio")
                );
                result = [...result, ...fileItems];
            } catch (error) {
                console.error(`无法读取目录 ${search}:`, error);
            }
        }
        cachedData.cacheFileList = result;
    }

    return {
        isEnd: true,
        data: (cachedData.cacheFileList || [])
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
    const client = getClient();
    return [
        {
            title: "全部歌曲",
            data: (cachedData.searchPathList || []).map((it) => ({
                title: it,
                id: it,
            })),
        },
    ];
}

// 获取排行榜详情
async function getTopListDetail(topListItem) {
    const client = getClient();
    const fileItems = (await client.getDirectoryContents(topListItem.id)).filter(
        (it) => it.type === "file" && it.mime.startsWith("audio")
    );
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
    author: "你的名字",
    version: "1.0.0",
    description: "从 WebDAV 服务器获取音乐、封面和歌词。",
    userVariables: [
        {
            key: "url",
            name: "WebDAV 地址",
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
            name: "歌曲存放路径（多个路径用逗号分隔）",
        },
    ],
    supportedSearchType: ["music"],
    search: searchMusic,
    getTopLists,
    getTopListDetail,
    getMediaSource,
};
