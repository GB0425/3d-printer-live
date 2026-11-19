// Compare only URLs that were actually received; never invent CDN resize URLs.
export function preferAvatar(current,candidate){
 const info=value=>{try{const url=new URL(value),path=url.pathname;const at=path.search(/aweme-avatar|tos-cn-avt/);const key=(at>=0?path.slice(at):path.replace(/\/\d+x\d+\//g,'/')).split('~')[0];const match=String(value).match(/(?:\/|[=_-])(\d{2,4})x(\d{2,4})(?:\/|[~.?_-])/);return {key,pixels:match?Number(match[1])*Number(match[2]):0}}catch{return {key:'',pixels:0}}};
 const a=info(current),b=info(candidate);return a.key&&a.key===b.key&&a.pixels>0&&b.pixels>0&&a.pixels>b.pixels?current:candidate;
}
