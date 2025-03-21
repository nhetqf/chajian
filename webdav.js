"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_1 = require("webdav");
let cachedData = {};

function getClient() {
    var _a, _b, _c;
    const { url, username, password, searchPath } = (_b = (_a = env === null || env === void 0 ? void 0 : env.getUserVariables) === null || _a === void 0 ? void 0 : _a.call(env)) !== null && _b !== void 0 ? _b : {};
    console.log('WebDAV URL:', url);
    console.log('WebDAV 用户名:', username);
    console.log('WebDAV 密码:', password);
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
           .map((it) => ({
                title: it.basename,
                id: it.filename,
                artist: "未知作者",
                album: "未知专辑",
            })),
    };
}

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

async function getTopListDetail(topListItem) {
    const client = getClient();
    const fileItems = (await client.getDirectoryContents(topListItem.id)).filter((it) => it.type === "file" && it.mime.startsWith("audio"));
    return {
        musicList: fileItems.map((it) => ({
            title: it.basename,
            id: it.filename,
            artist: "未知作者",
            album: "未知专辑",
        })),
    };
}

// 获取音乐详情（补充封面信息）
async function getMusicInfo(musicItem) {
    const client = getClient();
    try {
        const songPath = musicItem.id;
        // 尝试不同的封面文件格式，这里以 .jpg 和 .png 为例
        const possibleCoverExtensions = ['.jpg', '.png'];
        for (const ext of possibleCoverExtensions) {
            const coverPath = songPath.replace(/\.\w+$/, ext);
            console.log('构造的封面路径:', coverPath);
            const coverExists = await client.exists(coverPath);
            console.log('封面文件是否存在:', coverExists);
            if (coverExists) {
                const coverUrl = client.getFileDownloadLink(coverPath);
                return {
                    artwork: coverUrl
                };
            }
        }
        return null;
    } catch (error) {
        console.error('获取音乐封面信息出错:', error);
        return null;
    }
}

// 获取歌词
async function getLyric(musicItem) {
    const client = getClient();
    try {
        const songPath = musicItem.id;
        const lyricPath = songPath.replace(/\.\w+$/, '.lrc');
        const lyricExists = await client.exists(lyricPath);
        if (lyricExists) {
            const lyricContent = await client.getFileContents(lyricPath, { format: 'text' });
            return {
                rawLrc: lyricContent
            };
        }
        return null;
    } catch (error) {
        console.error('获取歌词信息出错:', error);
        return null;
    }
}

// 优化：增加一个辅助函数来检查文件是否存在并获取内容
async function checkAndGetFile(client, filePath, format = 'text') {
    const fileExists = await client.exists(filePath);
    if (fileExists) {
        return await client.getFileContents(filePath, { format });
    }
    return null;
}

// 优化后的获取音乐详情函数
async function getMusicInfoOptimized(musicItem) {
    const client = getClient();
    if (!client) return null;
    const songPath = musicItem.id;
    const possibleCoverExtensions = ['.jpg', '.png'];
    for (const ext of possibleCoverExtensions) {
        const coverPath = songPath.replace(/\.\w+$/, ext);
        const coverData = await checkAndGetFile(client, coverPath, 'buffer');
        if (coverData) {
            const coverUrl = client.getFileDownloadLink(coverPath);
            return {
                artwork: coverUrl
            };
        }
    }
    return null;
}

// 优化后的获取歌词函数
async function getLyricOptimized(musicItem) {
    const client = getClient();
    if (!client) return null;
    const songPath = musicItem.id;
    const lyricPath = songPath.replace(/\.\w+$/, '.lrc');
    const lyricContent = await checkAndGetFile(client, lyricPath);
    if (lyricContent) {
        return {
            rawLrc: lyricContent
        };
    }
    return null;
}

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
    getMediaSource(musicItem) {
        const client = getClient();
        return {
            url: client.getFileDownloadLink(musicItem.id),
        };
    },
    getMusicInfo: getMusicInfoOptimized,
    getLyric: getLyricOptimized
};
