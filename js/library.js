/*
 * Встроенное содержимое BM: ваша песня.
 * Положите файл в папку music/ с именем my-song.mp3.
 * Песни от ИИ — js/ai-songs-data.js, реальная музыка — js/catalog-data.js,
 * подкасты — js/podcasts-data.js.
 */
window.BM_LIBRARY = {
  userSong: {
    kind: 'file',
    id: 'user-song',
    blobId: 'user-song',
    src: 'music/my-song.mp3',
    title: 'Музыка без авторских прав',
    artist: 'Вы',
    license: 'own',
    hue: 32,
    glyph: '★'
  }
};
