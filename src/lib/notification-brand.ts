export function notificationBrand(edition:unknown){
 return edition==='retail'?{name:'AisleOps',icon:'/app-icon-retail-192.png'}:edition==='hotel'?{name:'FieldBridge Hotels',icon:'/app-icon-hotels-192.png'}:{name:'FieldBridge',icon:'/app-icon-192.png'};
}
export type NotificationAlert={title:string;body:string;url:string;tag:string};
export function brandedPushPayload(a:NotificationAlert,edition:unknown){const brand=notificationBrand(edition);return {title:a.title||brand.name,body:a.body||'You have a new team message',icon:brand.icon,badge:brand.icon,tag:a.tag,data:{url:a.url,chatId:a.tag}};}