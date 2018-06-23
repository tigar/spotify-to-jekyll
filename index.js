const _ = require('underscore');
const fs = require('fs');
const moment = require('moment');
const Jimp = require('jimp');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports.playlist = (event, context, callback) => {
  module.exports
    .getPlaylist()
    .then(module.exports.formatTracks)
    // create new post
    .then(data => module.exports.createPost(data))
    // save tracks to playlists.yml
    .then(data => module.exports.updateMaster(data))
    // save image to img/playlists/
    .then(data => module.exports.saveImage(data))
    .then(data => callback(null, data))
    .catch(err => callback(err));
};

module.exports.getPlaylist = () => {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SpotifyClientID,
    clientSecret: process.env.SpotifyClientSecret
  });

  return spotifyApi
    .clientCredentialsGrant()
    .then(data => spotifyApi.setAccessToken(data.body['access_token']))
    .then(() =>
      spotifyApi.getPlaylist(
        process.env.SpotifyUser,
        process.env.SpotifyPlaylist
      )
    )
    .then(data => data.body)
    .catch(err => err);
};

module.exports.formatTracks = data => {
  return new Promise(resolve => {
    resolve({
      name: data.name,
      formatted_name: data.name
        .replace('/', '-')
        .toLowerCase()
        .replace(' ', '-'),
      url: data.external_urls.spotify,
      tracks: module.exports.getTracks(data.tracks),
      image: _.findWhere(data.images, { width: 640 }).url
    });
  });
};

module.exports.getTracks = tracks => {
  return tracks.items.reduce((arr, item) => {
    arr.push({
      name: item.track.name,
      artist: _.pluck(item.track.artists, 'name').join(', '),
      album: item.track.album.name
    });
    return arr;
  }, []);
};

module.exports.createPost = data => {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      `_posts/playlists/${moment().format('YYYY-MM-DD')}-${
        data.formatted_name
      }.md`,
      module.exports.buildPost(data),
      err => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

module.exports.buildPost = data => {
  let contents = `---\nlayout: post\ntitle: ${
    data.name
  }\ncategory: playlists\nspotify: ${data.url}\nimage: img/playlists/${
    data.formatted_name
  }.png\npermalink: /playlists/${
    data.formatted_name
  }/\n---\n\n[Listen on Spotify](${data.url})\n\n`;
  data.tracks.map(track => {
    contents += `* ${track.name}, ${track.artist}\n`;
  });
  return contents;
};

module.exports.updateMaster = data => {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      '_data/playlists.yml',
      module.exports.buildNewMaster(data),
      err => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

module.exports.buildNewMaster = data => {
  let content = fs.readFileSync('_data/playlists.yml').toString('utf8');
  content += `- playlist: ${data.name}\n  spotify: ${data.url}\n  tracks:\n`;
  data.tracks.map(track => {
    content += `  - track: "${track.name}"\n    artist: "${
      track.artist
    }"\n    album: "${track.album}"\n`;
  });
  return content;
};

module.exports.saveImage = data => {
  return new Promise((resolve, reject) => {
    Jimp.read(data.image, (err, img) => {
      if (err) return reject(err);
      img.rgba(false).write(`img/playlists/${data.formatted_name}.png`);
      resolve('done!');
    });
  });
};