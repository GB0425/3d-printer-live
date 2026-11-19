export const FEMALE_VOICES = [
  {id:'kokoro-female',name:'本地中文女声 · 离线（推荐）'},
  {id:'zh-CN-XiaoxiaoNeural',name:'晓晓 · 温柔女声'},
  {id:'zh-CN-XiaoyiNeural',name:'晓伊 · 自然聊天（推荐）'},
  {id:'zh-CN-liaoning-XiaobeiNeural',name:'晓北 · 东北女声'},
  {id:'zh-CN-shaanxi-XiaoniNeural',name:'晓妮 · 陕西女声'}
];
export const DEFAULT_FEMALE_VOICE = 'edge:zh-CN-XiaoyiNeural';
export function isFemaleChineseVoice(v) {
  return /zh|cmn/i.test(v.lang||'') && /xiaoxiao|xiaoyi|xiaobei|xiaoni|huihui|yaoyao|hiu|hsiao|female|女/i.test(v.name||'');
}
