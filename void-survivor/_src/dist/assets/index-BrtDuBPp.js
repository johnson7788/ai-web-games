(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Ca="182",cc=0,ro=1,hc=2,As=1,uc=2,Vi=3,Un=0,It=1,mn=2,xn=0,Yn=1,Hi=2,ao=3,oo=4,dc=5,Hn=100,fc=101,pc=102,mc=103,gc=104,_c=200,xc=201,vc=202,Mc=203,Lr=204,Dr=205,Sc=206,yc=207,Ec=208,Tc=209,bc=210,wc=211,Ac=212,Rc=213,Cc=214,Ir=0,Ur=1,Nr=2,Mi=3,Fr=4,Or=5,Br=6,zr=7,dl=0,Pc=1,Lc=2,sn=0,fl=1,pl=2,ml=3,Pa=4,gl=5,_l=6,xl=7,vl=300,Kn=301,Si=302,kr=303,Vr=304,Bs=306,Gr=1e3,gn=1001,Hr=1002,yt=1003,Dc=1004,es=1005,wt=1006,js=1007,Xn=1008,kt=1009,Ml=1010,Sl=1011,Wi=1012,La=1013,an=1014,en=1015,Mn=1016,Da=1017,Ia=1018,Xi=1020,yl=35902,El=35899,Tl=1021,bl=1022,$t=1023,Sn=1026,qn=1027,wl=1028,Ua=1029,yi=1030,Na=1031,Fa=1033,Rs=33776,Cs=33777,Ps=33778,Ls=33779,Wr=35840,Xr=35841,qr=35842,Yr=35843,$r=36196,Kr=37492,jr=37496,Zr=37488,Jr=37489,Qr=37490,ea=37491,ta=37808,na=37809,ia=37810,sa=37811,ra=37812,aa=37813,oa=37814,la=37815,ca=37816,ha=37817,ua=37818,da=37819,fa=37820,pa=37821,ma=36492,ga=36494,_a=36495,xa=36283,va=36284,Ma=36285,Sa=36286,Ic=3200,Al=0,Uc=1,Pn="",Bt="srgb",Ei="srgb-linear",Is="linear",je="srgb",Jn=7680,lo=519,Nc=512,Fc=513,Oc=514,Oa=515,Bc=516,zc=517,Ba=518,kc=519,ya=35044,co="300 es",tn=2e3,Us=2001;function Rl(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function qi(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Vc(){const i=qi("canvas");return i.style.display="block",i}const ho={};function Ns(...i){const e="THREE."+i.shift();console.log(e,...i)}function Ce(...i){const e="THREE."+i.shift();console.warn(e,...i)}function Ve(...i){const e="THREE."+i.shift();console.error(e,...i)}function Yi(...i){const e=i.join(" ");e in ho||(ho[e]=!0,Ce(...i))}function Gc(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}class Ri{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Tt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Zs=Math.PI/180,Ea=180/Math.PI;function In(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Tt[i&255]+Tt[i>>8&255]+Tt[i>>16&255]+Tt[i>>24&255]+"-"+Tt[e&255]+Tt[e>>8&255]+"-"+Tt[e>>16&15|64]+Tt[e>>24&255]+"-"+Tt[t&63|128]+Tt[t>>8&255]+"-"+Tt[t>>16&255]+Tt[t>>24&255]+Tt[n&255]+Tt[n>>8&255]+Tt[n>>16&255]+Tt[n>>24&255]).toLowerCase()}function ke(i,e,t){return Math.max(e,Math.min(t,i))}function Hc(i,e){return(i%e+e)%e}function Js(i,e,t){return(1-t)*i+t*e}function Qt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Je(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}class Pe{constructor(e=0,t=0){Pe.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=ke(this.x,e.x,t.x),this.y=ke(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=ke(this.x,e,t),this.y=ke(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ke(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(ke(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ki{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3],d=r[a+0],p=r[a+1],_=r[a+2],M=r[a+3];if(o<=0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u;return}if(o>=1){e[t+0]=d,e[t+1]=p,e[t+2]=_,e[t+3]=M;return}if(u!==M||l!==d||c!==p||h!==_){let m=l*d+c*p+h*_+u*M;m<0&&(d=-d,p=-p,_=-_,M=-M,m=-m);let f=1-o;if(m<.9995){const y=Math.acos(m),b=Math.sin(y);f=Math.sin(f*y)/b,o=Math.sin(o*y)/b,l=l*f+d*o,c=c*f+p*o,h=h*f+_*o,u=u*f+M*o}else{l=l*f+d*o,c=c*f+p*o,h=h*f+_*o,u=u*f+M*o;const y=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=y,c*=y,h*=y,u*=y}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[a],d=r[a+1],p=r[a+2],_=r[a+3];return e[t]=o*_+h*u+l*p-c*d,e[t+1]=l*_+h*d+c*u-o*p,e[t+2]=c*_+h*p+o*d-l*u,e[t+3]=h*_-o*u-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(r/2),d=l(n/2),p=l(s/2),_=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*_,this._y=c*p*u-d*h*_,this._z=c*h*_+d*p*u,this._w=c*h*u-d*p*_;break;case"YXZ":this._x=d*h*u+c*p*_,this._y=c*p*u-d*h*_,this._z=c*h*_-d*p*u,this._w=c*h*u+d*p*_;break;case"ZXY":this._x=d*h*u-c*p*_,this._y=c*p*u+d*h*_,this._z=c*h*_+d*p*u,this._w=c*h*u-d*p*_;break;case"ZYX":this._x=d*h*u-c*p*_,this._y=c*p*u+d*h*_,this._z=c*h*_-d*p*u,this._w=c*h*u+d*p*_;break;case"YZX":this._x=d*h*u+c*p*_,this._y=c*p*u+d*h*_,this._z=c*h*_-d*p*u,this._w=c*h*u-d*p*_;break;case"XZY":this._x=d*h*u-c*p*_,this._y=c*p*u-d*h*_,this._z=c*h*_+d*p*u,this._w=c*h*u+d*p*_;break;default:Ce("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-s)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(s+a)/p,this._z=(r+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(r-c)/p,this._x=(s+a)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(a-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ke(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t<=0)return this;if(t>=1)return this.copy(e);let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{constructor(e=0,t=0,n=0){L.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(uo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(uo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),h=2*(o*t-r*s),u=2*(r*n-a*t);return this.x=t+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=ke(this.x,e.x,t.x),this.y=ke(this.y,e.y,t.y),this.z=ke(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=ke(this.x,e,t),this.y=ke(this.y,e,t),this.z=ke(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ke(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Qs.copy(this).projectOnVector(e),this.sub(Qs)}reflect(e){return this.sub(Qs.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(ke(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Qs=new L,uo=new Ki;class De{constructor(e,t,n,s,r,a,o,l,c){De.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],_=n[8],M=s[0],m=s[3],f=s[6],y=s[1],b=s[4],E=s[7],w=s[2],A=s[5],R=s[8];return r[0]=a*M+o*y+l*w,r[3]=a*m+o*b+l*A,r[6]=a*f+o*E+l*R,r[1]=c*M+h*y+u*w,r[4]=c*m+h*b+u*A,r[7]=c*f+h*E+u*R,r[2]=d*M+p*y+_*w,r[5]=d*m+p*b+_*A,r[8]=d*f+p*E+_*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,_=t*u+n*d+s*p;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const M=1/_;return e[0]=u*M,e[1]=(s*c-h*n)*M,e[2]=(o*n-s*a)*M,e[3]=d*M,e[4]=(h*t-s*l)*M,e[5]=(s*r-o*t)*M,e[6]=p*M,e[7]=(n*l-c*t)*M,e[8]=(a*t-n*r)*M,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(er.makeScale(e,t)),this}rotate(e){return this.premultiply(er.makeRotation(-e)),this}translate(e,t){return this.premultiply(er.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const er=new De,fo=new De().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),po=new De().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Wc(){const i={enabled:!0,workingColorSpace:Ei,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===je&&(s.r=vn(s.r),s.g=vn(s.g),s.b=vn(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===je&&(s.r=_i(s.r),s.g=_i(s.g),s.b=_i(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Pn?Is:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Yi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Yi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Ei]:{primaries:e,whitePoint:n,transfer:Is,toXYZ:fo,fromXYZ:po,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Bt},outputColorSpaceConfig:{drawingBufferColorSpace:Bt}},[Bt]:{primaries:e,whitePoint:n,transfer:je,toXYZ:fo,fromXYZ:po,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Bt}}}),i}const He=Wc();function vn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function _i(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let Qn;class Xc{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Qn===void 0&&(Qn=qi("canvas")),Qn.width=e.width,Qn.height=e.height;const s=Qn.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=Qn}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=qi("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=vn(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(vn(t[n]/255)*255):t[n]=vn(t[n]);return{data:t,width:e.width,height:e.height}}else return Ce("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let qc=0;class za{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:qc++}),this.uuid=In(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(tr(s[a].image)):r.push(tr(s[a]))}else r=tr(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function tr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Xc.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Ce("Texture: Unable to serialize Texture."),{})}let Yc=0;const nr=new L;class Et extends Ri{constructor(e=Et.DEFAULT_IMAGE,t=Et.DEFAULT_MAPPING,n=gn,s=gn,r=wt,a=Xn,o=$t,l=kt,c=Et.DEFAULT_ANISOTROPY,h=Pn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Yc++}),this.uuid=In(),this.name="",this.source=new za(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Pe(0,0),this.repeat=new Pe(1,1),this.center=new Pe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new De,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(nr).x}get height(){return this.source.getSize(nr).y}get depth(){return this.source.getSize(nr).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Ce(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ce(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==vl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Gr:e.x=e.x-Math.floor(e.x);break;case gn:e.x=e.x<0?0:1;break;case Hr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Gr:e.y=e.y-Math.floor(e.y);break;case gn:e.y=e.y<0?0:1;break;case Hr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Et.DEFAULT_IMAGE=null;Et.DEFAULT_MAPPING=vl;Et.DEFAULT_ANISOTROPY=1;class ht{constructor(e=0,t=0,n=0,s=1){ht.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],_=l[9],M=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-M)<.01&&Math.abs(_-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+M)<.1&&Math.abs(_+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const b=(c+1)/2,E=(p+1)/2,w=(f+1)/2,A=(h+d)/4,R=(u+M)/4,I=(_+m)/4;return b>E&&b>w?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=A/n,r=R/n):E>w?E<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(E),n=A/s,r=I/s):w<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),n=R/r,s=I/r),this.set(n,s,r,t),this}let y=Math.sqrt((m-_)*(m-_)+(u-M)*(u-M)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(m-_)/y,this.y=(u-M)/y,this.z=(d-h)/y,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=ke(this.x,e.x,t.x),this.y=ke(this.y,e.y,t.y),this.z=ke(this.z,e.z,t.z),this.w=ke(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=ke(this.x,e,t),this.y=ke(this.y,e,t),this.z=ke(this.z,e,t),this.w=ke(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ke(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class $c extends Ri{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:wt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ht(0,0,e,t),this.scissorTest=!1,this.viewport=new ht(0,0,e,t);const s={width:e,height:t,depth:n.depth},r=new Et(s);this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:wt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new za(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class rn extends $c{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Cl extends Et{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=yt,this.minFilter=yt,this.wrapR=gn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Kc extends Et{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=yt,this.minFilter=yt,this.wrapR=gn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ji{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Xt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Xt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Xt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Xt):Xt.fromBufferAttribute(r,a),Xt.applyMatrix4(e.matrixWorld),this.expandByPoint(Xt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ts.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ts.copy(n.boundingBox)),ts.applyMatrix4(e.matrixWorld),this.union(ts)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Xt),Xt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Di),ns.subVectors(this.max,Di),ei.subVectors(e.a,Di),ti.subVectors(e.b,Di),ni.subVectors(e.c,Di),En.subVectors(ti,ei),Tn.subVectors(ni,ti),On.subVectors(ei,ni);let t=[0,-En.z,En.y,0,-Tn.z,Tn.y,0,-On.z,On.y,En.z,0,-En.x,Tn.z,0,-Tn.x,On.z,0,-On.x,-En.y,En.x,0,-Tn.y,Tn.x,0,-On.y,On.x,0];return!ir(t,ei,ti,ni,ns)||(t=[1,0,0,0,1,0,0,0,1],!ir(t,ei,ti,ni,ns))?!1:(is.crossVectors(En,Tn),t=[is.x,is.y,is.z],ir(t,ei,ti,ni,ns))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Xt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Xt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(hn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),hn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),hn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),hn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),hn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),hn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),hn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),hn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(hn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const hn=[new L,new L,new L,new L,new L,new L,new L,new L],Xt=new L,ts=new ji,ei=new L,ti=new L,ni=new L,En=new L,Tn=new L,On=new L,Di=new L,ns=new L,is=new L,Bn=new L;function ir(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Bn.fromArray(i,r);const o=s.x*Math.abs(Bn.x)+s.y*Math.abs(Bn.y)+s.z*Math.abs(Bn.z),l=e.dot(Bn),c=t.dot(Bn),h=n.dot(Bn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const jc=new ji,Ii=new L,sr=new L;class zs{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):jc.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ii.subVectors(e,this.center);const t=Ii.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Ii,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(sr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ii.copy(e.center).add(sr)),this.expandByPoint(Ii.copy(e.center).sub(sr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const un=new L,rr=new L,ss=new L,bn=new L,ar=new L,rs=new L,or=new L;class ka{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,un)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=un.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(un.copy(this.origin).addScaledVector(this.direction,t),un.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){rr.copy(e).add(t).multiplyScalar(.5),ss.copy(t).sub(e).normalize(),bn.copy(this.origin).sub(rr);const r=e.distanceTo(t)*.5,a=-this.direction.dot(ss),o=bn.dot(this.direction),l=-bn.dot(ss),c=bn.lengthSq(),h=Math.abs(1-a*a);let u,d,p,_;if(h>0)if(u=a*l-o,d=a*o-l,_=r*h,u>=0)if(d>=-_)if(d<=_){const M=1/h;u*=M,d*=M,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-_?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=_?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(rr).addScaledVector(ss,d),p}intersectSphere(e,t){un.subVectors(e.center,this.origin);const n=un.dot(this.direction),s=un.dot(un)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,un)!==null}intersectTriangle(e,t,n,s,r){ar.subVectors(t,e),rs.subVectors(n,e),or.crossVectors(ar,rs);let a=this.direction.dot(or),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;bn.subVectors(this.origin,e);const l=o*this.direction.dot(rs.crossVectors(bn,rs));if(l<0)return null;const c=o*this.direction.dot(ar.cross(bn));if(c<0||l+c>a)return null;const h=-o*bn.dot(or);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class rt{constructor(e,t,n,s,r,a,o,l,c,h,u,d,p,_,M,m){rt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,h,u,d,p,_,M,m)}set(e,t,n,s,r,a,o,l,c,h,u,d,p,_,M,m){const f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=s,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=_,f[11]=M,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new rt().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinant()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();const t=this.elements,n=e.elements,s=1/ii.setFromMatrixColumn(e,0).length(),r=1/ii.setFromMatrixColumn(e,1).length(),a=1/ii.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){const d=a*h,p=a*u,_=o*h,M=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+_*c,t[5]=d-M*c,t[9]=-o*l,t[2]=M-d*c,t[6]=_+p*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*h,p=l*u,_=c*h,M=c*u;t[0]=d+M*o,t[4]=_*o-p,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=p*o-_,t[6]=M+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*h,p=l*u,_=c*h,M=c*u;t[0]=d-M*o,t[4]=-a*u,t[8]=_+p*o,t[1]=p+_*o,t[5]=a*h,t[9]=M-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*h,p=a*u,_=o*h,M=o*u;t[0]=l*h,t[4]=_*c-p,t[8]=d*c+M,t[1]=l*u,t[5]=M*c+d,t[9]=p*c-_,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,p=a*c,_=o*l,M=o*c;t[0]=l*h,t[4]=M-d*u,t[8]=_*u+p,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*u+_,t[10]=d-M*u}else if(e.order==="XZY"){const d=a*l,p=a*c,_=o*l,M=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+M,t[5]=a*h,t[9]=p*u-_,t[2]=_*u-p,t[6]=o*h,t[10]=M*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Zc,e,Jc)}lookAt(e,t,n){const s=this.elements;return Ft.subVectors(e,t),Ft.lengthSq()===0&&(Ft.z=1),Ft.normalize(),wn.crossVectors(n,Ft),wn.lengthSq()===0&&(Math.abs(n.z)===1?Ft.x+=1e-4:Ft.z+=1e-4,Ft.normalize(),wn.crossVectors(n,Ft)),wn.normalize(),as.crossVectors(Ft,wn),s[0]=wn.x,s[4]=as.x,s[8]=Ft.x,s[1]=wn.y,s[5]=as.y,s[9]=Ft.y,s[2]=wn.z,s[6]=as.z,s[10]=Ft.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],_=n[2],M=n[6],m=n[10],f=n[14],y=n[3],b=n[7],E=n[11],w=n[15],A=s[0],R=s[4],I=s[8],x=s[12],S=s[1],P=s[5],O=s[9],B=s[13],X=s[2],W=s[6],G=s[10],V=s[14],j=s[3],he=s[7],ae=s[11],ue=s[15];return r[0]=a*A+o*S+l*X+c*j,r[4]=a*R+o*P+l*W+c*he,r[8]=a*I+o*O+l*G+c*ae,r[12]=a*x+o*B+l*V+c*ue,r[1]=h*A+u*S+d*X+p*j,r[5]=h*R+u*P+d*W+p*he,r[9]=h*I+u*O+d*G+p*ae,r[13]=h*x+u*B+d*V+p*ue,r[2]=_*A+M*S+m*X+f*j,r[6]=_*R+M*P+m*W+f*he,r[10]=_*I+M*O+m*G+f*ae,r[14]=_*x+M*B+m*V+f*ue,r[3]=y*A+b*S+E*X+w*j,r[7]=y*R+b*P+E*W+w*he,r[11]=y*I+b*O+E*G+w*ae,r[15]=y*x+b*B+E*V+w*ue,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],p=e[14],_=e[3],M=e[7],m=e[11],f=e[15],y=l*p-c*d,b=o*p-c*u,E=o*d-l*u,w=a*p-c*h,A=a*d-l*h,R=a*u-o*h;return t*(M*y-m*b+f*E)-n*(_*y-m*w+f*A)+s*(_*b-M*w+f*R)-r*(_*E-M*A+m*R)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],p=e[11],_=e[12],M=e[13],m=e[14],f=e[15],y=u*m*c-M*d*c+M*l*p-o*m*p-u*l*f+o*d*f,b=_*d*c-h*m*c-_*l*p+a*m*p+h*l*f-a*d*f,E=h*M*c-_*u*c+_*o*p-a*M*p-h*o*f+a*u*f,w=_*u*l-h*M*l-_*o*d+a*M*d+h*o*m-a*u*m,A=t*y+n*b+s*E+r*w;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/A;return e[0]=y*R,e[1]=(M*d*r-u*m*r-M*s*p+n*m*p+u*s*f-n*d*f)*R,e[2]=(o*m*r-M*l*r+M*s*c-n*m*c-o*s*f+n*l*f)*R,e[3]=(u*l*r-o*d*r-u*s*c+n*d*c+o*s*p-n*l*p)*R,e[4]=b*R,e[5]=(h*m*r-_*d*r+_*s*p-t*m*p-h*s*f+t*d*f)*R,e[6]=(_*l*r-a*m*r-_*s*c+t*m*c+a*s*f-t*l*f)*R,e[7]=(a*d*r-h*l*r+h*s*c-t*d*c-a*s*p+t*l*p)*R,e[8]=E*R,e[9]=(_*u*r-h*M*r-_*n*p+t*M*p+h*n*f-t*u*f)*R,e[10]=(a*M*r-_*o*r+_*n*c-t*M*c-a*n*f+t*o*f)*R,e[11]=(h*o*r-a*u*r-h*n*c+t*u*c+a*n*p-t*o*p)*R,e[12]=w*R,e[13]=(h*M*s-_*u*s+_*n*d-t*M*d-h*n*m+t*u*m)*R,e[14]=(_*o*s-a*M*s-_*n*l+t*M*l+a*n*m-t*o*m)*R,e[15]=(a*u*s-h*o*s+h*n*l-t*u*l-a*n*d+t*o*d)*R,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,_=r*u,M=a*h,m=a*u,f=o*u,y=l*c,b=l*h,E=l*u,w=n.x,A=n.y,R=n.z;return s[0]=(1-(M+f))*w,s[1]=(p+E)*w,s[2]=(_-b)*w,s[3]=0,s[4]=(p-E)*A,s[5]=(1-(d+f))*A,s[6]=(m+y)*A,s[7]=0,s[8]=(_+b)*R,s[9]=(m-y)*R,s[10]=(1-(d+M))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;if(e.x=s[12],e.y=s[13],e.z=s[14],this.determinant()===0)return n.set(1,1,1),t.identity(),this;let r=ii.set(s[0],s[1],s[2]).length();const a=ii.set(s[4],s[5],s[6]).length(),o=ii.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),qt.copy(this);const c=1/r,h=1/a,u=1/o;return qt.elements[0]*=c,qt.elements[1]*=c,qt.elements[2]*=c,qt.elements[4]*=h,qt.elements[5]*=h,qt.elements[6]*=h,qt.elements[8]*=u,qt.elements[9]*=u,qt.elements[10]*=u,t.setFromRotationMatrix(qt),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,s,r,a,o=tn,l=!1){const c=this.elements,h=2*r/(t-e),u=2*r/(n-s),d=(t+e)/(t-e),p=(n+s)/(n-s);let _,M;if(l)_=r/(a-r),M=a*r/(a-r);else if(o===tn)_=-(a+r)/(a-r),M=-2*a*r/(a-r);else if(o===Us)_=-a/(a-r),M=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=M,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=tn,l=!1){const c=this.elements,h=2/(t-e),u=2/(n-s),d=-(t+e)/(t-e),p=-(n+s)/(n-s);let _,M;if(l)_=1/(a-r),M=a/(a-r);else if(o===tn)_=-2/(a-r),M=-(a+r)/(a-r);else if(o===Us)_=-1/(a-r),M=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=_,c[14]=M,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const ii=new L,qt=new rt,Zc=new L(0,0,0),Jc=new L(1,1,1),wn=new L,as=new L,Ft=new L,mo=new rt,go=new Ki;class on{constructor(e=0,t=0,n=0,s=on.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],p=s[10];switch(t){case"XYZ":this._y=Math.asin(ke(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ke(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(ke(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-ke(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(ke(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-ke(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:Ce("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return mo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(mo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return go.setFromEuler(this),this.setFromQuaternion(go,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}on.DEFAULT_ORDER="XYZ";class Va{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Qc=0;const _o=new L,si=new Ki,dn=new rt,os=new L,Ui=new L,eh=new L,th=new Ki,xo=new L(1,0,0),vo=new L(0,1,0),Mo=new L(0,0,1),So={type:"added"},nh={type:"removed"},ri={type:"childadded",child:null},lr={type:"childremoved",child:null};class mt extends Ri{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Qc++}),this.uuid=In(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=mt.DEFAULT_UP.clone();const e=new L,t=new on,n=new Ki,s=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new rt},normalMatrix:{value:new De}}),this.matrix=new rt,this.matrixWorld=new rt,this.matrixAutoUpdate=mt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=mt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Va,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return si.setFromAxisAngle(e,t),this.quaternion.multiply(si),this}rotateOnWorldAxis(e,t){return si.setFromAxisAngle(e,t),this.quaternion.premultiply(si),this}rotateX(e){return this.rotateOnAxis(xo,e)}rotateY(e){return this.rotateOnAxis(vo,e)}rotateZ(e){return this.rotateOnAxis(Mo,e)}translateOnAxis(e,t){return _o.copy(e).applyQuaternion(this.quaternion),this.position.add(_o.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(xo,e)}translateY(e){return this.translateOnAxis(vo,e)}translateZ(e){return this.translateOnAxis(Mo,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(dn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?os.copy(e):os.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Ui.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?dn.lookAt(Ui,os,this.up):dn.lookAt(os,Ui,this.up),this.quaternion.setFromRotationMatrix(dn),s&&(dn.extractRotation(s.matrixWorld),si.setFromRotationMatrix(dn),this.quaternion.premultiply(si.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ve("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(So),ri.child=e,this.dispatchEvent(ri),ri.child=null):Ve("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(nh),lr.child=e,this.dispatchEvent(lr),lr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),dn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),dn.multiply(e.parent.matrixWorld)),e.applyMatrix4(dn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(So),ri.child=e,this.dispatchEvent(ri),ri.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ui,e,eh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ui,th,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),p=a(e.animations),_=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),_.length>0&&(n.nodes=_)}return n.object=s,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}mt.DEFAULT_UP=new L(0,1,0);mt.DEFAULT_MATRIX_AUTO_UPDATE=!0;mt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Yt=new L,fn=new L,cr=new L,pn=new L,ai=new L,oi=new L,yo=new L,hr=new L,ur=new L,dr=new L,fr=new ht,pr=new ht,mr=new ht;class Ht{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Yt.subVectors(e,t),s.cross(Yt);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Yt.subVectors(s,t),fn.subVectors(n,t),cr.subVectors(e,t);const a=Yt.dot(Yt),o=Yt.dot(fn),l=Yt.dot(cr),c=fn.dot(fn),h=fn.dot(cr),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,_=(a*h-o*l)*d;return r.set(1-p-_,_,p)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,pn)===null?!1:pn.x>=0&&pn.y>=0&&pn.x+pn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,pn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,pn.x),l.addScaledVector(a,pn.y),l.addScaledVector(o,pn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return fr.setScalar(0),pr.setScalar(0),mr.setScalar(0),fr.fromBufferAttribute(e,t),pr.fromBufferAttribute(e,n),mr.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(fr,r.x),a.addScaledVector(pr,r.y),a.addScaledVector(mr,r.z),a}static isFrontFacing(e,t,n,s){return Yt.subVectors(n,t),fn.subVectors(e,t),Yt.cross(fn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Yt.subVectors(this.c,this.b),fn.subVectors(this.a,this.b),Yt.cross(fn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Ht.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Ht.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return Ht.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return Ht.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Ht.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;ai.subVectors(s,n),oi.subVectors(r,n),hr.subVectors(e,n);const l=ai.dot(hr),c=oi.dot(hr);if(l<=0&&c<=0)return t.copy(n);ur.subVectors(e,s);const h=ai.dot(ur),u=oi.dot(ur);if(h>=0&&u<=h)return t.copy(s);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(ai,a);dr.subVectors(e,r);const p=ai.dot(dr),_=oi.dot(dr);if(_>=0&&p<=_)return t.copy(r);const M=p*c-l*_;if(M<=0&&c>=0&&_<=0)return o=c/(c-_),t.copy(n).addScaledVector(oi,o);const m=h*_-p*u;if(m<=0&&u-h>=0&&p-_>=0)return yo.subVectors(r,s),o=(u-h)/(u-h+(p-_)),t.copy(s).addScaledVector(yo,o);const f=1/(m+M+d);return a=M*f,o=d*f,t.copy(n).addScaledVector(ai,a).addScaledVector(oi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Pl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},An={h:0,s:0,l:0},ls={h:0,s:0,l:0};function gr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class ze{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Bt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,He.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=He.workingColorSpace){return this.r=e,this.g=t,this.b=n,He.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=He.workingColorSpace){if(e=Hc(e,1),t=ke(t,0,1),n=ke(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=gr(a,r,e+1/3),this.g=gr(a,r,e),this.b=gr(a,r,e-1/3)}return He.colorSpaceToWorking(this,s),this}setStyle(e,t=Bt){function n(r){r!==void 0&&parseFloat(r)<1&&Ce("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ce("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Ce("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Bt){const n=Pl[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Ce("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=vn(e.r),this.g=vn(e.g),this.b=vn(e.b),this}copyLinearToSRGB(e){return this.r=_i(e.r),this.g=_i(e.g),this.b=_i(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Bt){return He.workingToColorSpace(bt.copy(this),e),Math.round(ke(bt.r*255,0,255))*65536+Math.round(ke(bt.g*255,0,255))*256+Math.round(ke(bt.b*255,0,255))}getHexString(e=Bt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=He.workingColorSpace){He.workingToColorSpace(bt.copy(this),t);const n=bt.r,s=bt.g,r=bt.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=He.workingColorSpace){return He.workingToColorSpace(bt.copy(this),t),e.r=bt.r,e.g=bt.g,e.b=bt.b,e}getStyle(e=Bt){He.workingToColorSpace(bt.copy(this),e);const t=bt.r,n=bt.g,s=bt.b;return e!==Bt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(An),this.setHSL(An.h+e,An.s+t,An.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(An),e.getHSL(ls);const n=Js(An.h,ls.h,t),s=Js(An.s,ls.s,t),r=Js(An.l,ls.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const bt=new ze;ze.NAMES=Pl;let ih=0;class jn extends Ri{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:ih++}),this.uuid=In(),this.name="",this.type="Material",this.blending=Yn,this.side=Un,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Lr,this.blendDst=Dr,this.blendEquation=Hn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ze(0,0,0),this.blendAlpha=0,this.depthFunc=Mi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=lo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Jn,this.stencilZFail=Jn,this.stencilZPass=Jn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Ce(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ce(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Yn&&(n.blending=this.blending),this.side!==Un&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Lr&&(n.blendSrc=this.blendSrc),this.blendDst!==Dr&&(n.blendDst=this.blendDst),this.blendEquation!==Hn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Mi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==lo&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Jn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Jn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Jn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class nn extends jn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ze(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.combine=dl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const pt=new L,cs=new Pe;let sh=0;class Wt{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:sh++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=ya,this.updateRanges=[],this.gpuType=en,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)cs.fromBufferAttribute(this,t),cs.applyMatrix3(e),this.setXY(t,cs.x,cs.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyMatrix3(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyMatrix4(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyNormalMatrix(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.transformDirection(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Qt(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Qt(t,this.array)),t}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Qt(t,this.array)),t}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Qt(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Qt(t,this.array)),t}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),s=Je(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),s=Je(s,this.array),r=Je(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==ya&&(e.usage=this.usage),e}}class Ll extends Wt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Dl extends Wt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class St extends Wt{constructor(e,t,n){super(new Float32Array(e),t,n)}}let rh=0;const Gt=new rt,_r=new mt,li=new L,Ot=new ji,Ni=new ji,vt=new L;class Pt extends Ri{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:rh++}),this.uuid=In(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Rl(e)?Dl:Ll)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new De().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Gt.makeRotationFromQuaternion(e),this.applyMatrix4(Gt),this}rotateX(e){return Gt.makeRotationX(e),this.applyMatrix4(Gt),this}rotateY(e){return Gt.makeRotationY(e),this.applyMatrix4(Gt),this}rotateZ(e){return Gt.makeRotationZ(e),this.applyMatrix4(Gt),this}translate(e,t,n){return Gt.makeTranslation(e,t,n),this.applyMatrix4(Gt),this}scale(e,t,n){return Gt.makeScale(e,t,n),this.applyMatrix4(Gt),this}lookAt(e){return _r.lookAt(e),_r.updateMatrix(),this.applyMatrix4(_r.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(li).negate(),this.translate(li.x,li.y,li.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new St(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Ce("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ji);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ve("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];Ot.setFromBufferAttribute(r),this.morphTargetsRelative?(vt.addVectors(this.boundingBox.min,Ot.min),this.boundingBox.expandByPoint(vt),vt.addVectors(this.boundingBox.max,Ot.max),this.boundingBox.expandByPoint(vt)):(this.boundingBox.expandByPoint(Ot.min),this.boundingBox.expandByPoint(Ot.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ve('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new zs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ve("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){const n=this.boundingSphere.center;if(Ot.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Ni.setFromBufferAttribute(o),this.morphTargetsRelative?(vt.addVectors(Ot.min,Ni.min),Ot.expandByPoint(vt),vt.addVectors(Ot.max,Ni.max),Ot.expandByPoint(vt)):(Ot.expandByPoint(Ni.min),Ot.expandByPoint(Ni.max))}Ot.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)vt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(vt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)vt.fromBufferAttribute(o,c),l&&(li.fromBufferAttribute(e,c),vt.add(li)),s=Math.max(s,n.distanceToSquared(vt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ve('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ve("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Wt(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let I=0;I<n.count;I++)o[I]=new L,l[I]=new L;const c=new L,h=new L,u=new L,d=new Pe,p=new Pe,_=new Pe,M=new L,m=new L;function f(I,x,S){c.fromBufferAttribute(n,I),h.fromBufferAttribute(n,x),u.fromBufferAttribute(n,S),d.fromBufferAttribute(r,I),p.fromBufferAttribute(r,x),_.fromBufferAttribute(r,S),h.sub(c),u.sub(c),p.sub(d),_.sub(d);const P=1/(p.x*_.y-_.x*p.y);isFinite(P)&&(M.copy(h).multiplyScalar(_.y).addScaledVector(u,-p.y).multiplyScalar(P),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-_.x).multiplyScalar(P),o[I].add(M),o[x].add(M),o[S].add(M),l[I].add(m),l[x].add(m),l[S].add(m))}let y=this.groups;y.length===0&&(y=[{start:0,count:e.count}]);for(let I=0,x=y.length;I<x;++I){const S=y[I],P=S.start,O=S.count;for(let B=P,X=P+O;B<X;B+=3)f(e.getX(B+0),e.getX(B+1),e.getX(B+2))}const b=new L,E=new L,w=new L,A=new L;function R(I){w.fromBufferAttribute(s,I),A.copy(w);const x=o[I];b.copy(x),b.sub(w.multiplyScalar(w.dot(x))).normalize(),E.crossVectors(A,x);const P=E.dot(l[I])<0?-1:1;a.setXYZW(I,b.x,b.y,b.z,P)}for(let I=0,x=y.length;I<x;++I){const S=y[I],P=S.start,O=S.count;for(let B=P,X=P+O;B<X;B+=3)R(e.getX(B+0)),R(e.getX(B+1)),R(e.getX(B+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Wt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const s=new L,r=new L,a=new L,o=new L,l=new L,c=new L,h=new L,u=new L;if(e)for(let d=0,p=e.count;d<p;d+=3){const _=e.getX(d+0),M=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,M),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,M),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(M,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)vt.fromBufferAttribute(e,t),vt.normalize(),e.setXYZ(t,vt.x,vt.y,vt.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,_=0;for(let M=0,m=l.length;M<m;M++){o.isInterleavedBufferAttribute?p=l[M]*o.data.stride+o.offset:p=l[M]*h;for(let f=0;f<h;f++)d[_++]=c[p++]}return new Wt(d,h,u)}if(this.index===null)return Ce("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Pt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],p=e(d,n);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Eo=new rt,zn=new ka,hs=new zs,To=new L,us=new L,ds=new L,fs=new L,xr=new L,ps=new L,bo=new L,ms=new L;class ot extends mt{constructor(e=new Pt,t=new nn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){ps.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(xr.fromBufferAttribute(u,e),a?ps.addScaledVector(xr,h):ps.addScaledVector(xr.sub(t),h))}t.add(ps)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),hs.copy(n.boundingSphere),hs.applyMatrix4(r),zn.copy(e.ray).recast(e.near),!(hs.containsPoint(zn.origin)===!1&&(zn.intersectSphere(hs,To)===null||zn.origin.distanceToSquared(To)>(e.far-e.near)**2))&&(Eo.copy(r).invert(),zn.copy(e.ray).applyMatrix4(Eo),!(n.boundingBox!==null&&zn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,zn)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,M=d.length;_<M;_++){const m=d[_],f=a[m.materialIndex],y=Math.max(m.start,p.start),b=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let E=y,w=b;E<w;E+=3){const A=o.getX(E),R=o.getX(E+1),I=o.getX(E+2);s=gs(this,f,e,n,c,h,u,A,R,I),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),M=Math.min(o.count,p.start+p.count);for(let m=_,f=M;m<f;m+=3){const y=o.getX(m),b=o.getX(m+1),E=o.getX(m+2);s=gs(this,a,e,n,c,h,u,y,b,E),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,M=d.length;_<M;_++){const m=d[_],f=a[m.materialIndex],y=Math.max(m.start,p.start),b=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let E=y,w=b;E<w;E+=3){const A=E,R=E+1,I=E+2;s=gs(this,f,e,n,c,h,u,A,R,I),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),M=Math.min(l.count,p.start+p.count);for(let m=_,f=M;m<f;m+=3){const y=m,b=m+1,E=m+2;s=gs(this,a,e,n,c,h,u,y,b,E),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function ah(i,e,t,n,s,r,a,o){let l;if(e.side===It?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===Un,o),l===null)return null;ms.copy(o),ms.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(ms);return c<t.near||c>t.far?null:{distance:c,point:ms.clone(),object:i}}function gs(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,us),i.getVertexPosition(l,ds),i.getVertexPosition(c,fs);const h=ah(i,e,t,n,us,ds,fs,bo);if(h){const u=new L;Ht.getBarycoord(bo,us,ds,fs,u),s&&(h.uv=Ht.getInterpolatedAttribute(s,o,l,c,u,new Pe)),r&&(h.uv1=Ht.getInterpolatedAttribute(r,o,l,c,u,new Pe)),a&&(h.normal=Ht.getInterpolatedAttribute(a,o,l,c,u,new L),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new L,materialIndex:0};Ht.getNormal(us,ds,fs,d.normal),h.face=d,h.barycoord=u}return h}class yn extends Pt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,p=0;_("z","y","x",-1,-1,n,t,e,a,r,0),_("z","y","x",1,-1,n,t,-e,a,r,1),_("x","z","y",1,1,e,n,t,s,a,2),_("x","z","y",1,-1,e,n,-t,s,a,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new St(c,3)),this.setAttribute("normal",new St(h,3)),this.setAttribute("uv",new St(u,2));function _(M,m,f,y,b,E,w,A,R,I,x){const S=E/R,P=w/I,O=E/2,B=w/2,X=A/2,W=R+1,G=I+1;let V=0,j=0;const he=new L;for(let ae=0;ae<G;ae++){const ue=ae*P-B;for(let Oe=0;Oe<W;Oe++){const Ue=Oe*S-O;he[M]=Ue*y,he[m]=ue*b,he[f]=X,c.push(he.x,he.y,he.z),he[M]=0,he[m]=0,he[f]=A>0?1:-1,h.push(he.x,he.y,he.z),u.push(Oe/R),u.push(1-ae/I),V+=1}}for(let ae=0;ae<I;ae++)for(let ue=0;ue<R;ue++){const Oe=d+ue+W*ae,Ue=d+ue+W*(ae+1),at=d+(ue+1)+W*(ae+1),st=d+(ue+1)+W*ae;l.push(Oe,Ue,st),l.push(Ue,at,st),j+=6}o.addGroup(p,j,x),p+=j,d+=V}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new yn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Ti(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(Ce("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function Ct(i){const e={};for(let t=0;t<i.length;t++){const n=Ti(i[t]);for(const s in n)e[s]=n[s]}return e}function oh(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Il(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:He.workingColorSpace}const lh={clone:Ti,merge:Ct};var ch=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,hh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ln extends jn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=ch,this.fragmentShader=hh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ti(e.uniforms),this.uniformsGroups=oh(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}let Ul=class extends mt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new rt,this.projectionMatrix=new rt,this.projectionMatrixInverse=new rt,this.coordinateSystem=tn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}};const Rn=new L,wo=new Pe,Ao=new Pe;class zt extends Ul{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ea*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Zs*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ea*2*Math.atan(Math.tan(Zs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Rn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Rn.x,Rn.y).multiplyScalar(-e/Rn.z),Rn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Rn.x,Rn.y).multiplyScalar(-e/Rn.z)}getViewSize(e,t){return this.getViewBounds(e,wo,Ao),t.subVectors(Ao,wo)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Zs*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const ci=-90,hi=1;class uh extends mt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new zt(ci,hi,e,t);s.layers=this.layers,this.add(s);const r=new zt(ci,hi,e,t);r.layers=this.layers,this.add(r);const a=new zt(ci,hi,e,t);a.layers=this.layers,this.add(a);const o=new zt(ci,hi,e,t);o.layers=this.layers,this.add(o);const l=new zt(ci,hi,e,t);l.layers=this.layers,this.add(l);const c=new zt(ci,hi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===tn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Us)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const M=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,a),e.setRenderTarget(n,2,s),e.render(t,o),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=M,e.setRenderTarget(n,5,s),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class Nl extends Et{constructor(e=[],t=Kn,n,s,r,a,o,l,c,h){super(e,t,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Fl extends rn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Nl(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new yn(5,5,5),r=new ln({name:"CubemapFromEquirect",uniforms:Ti(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:It,blending:xn});r.uniforms.tEquirect.value=t;const a=new ot(s,r),o=t.minFilter;return t.minFilter===Xn&&(t.minFilter=wt),new uh(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}class _n extends mt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const dh={type:"move"};class vr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new _n,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new _n,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new _n,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const M of e.hand.values()){const m=t.getJointPose(M,n),f=this._getHandJoint(c,M);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,_=.005;c.inputState.pinching&&d>p+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(dh)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new _n;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class Ga{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new ze(e),this.density=t}clone(){return new Ga(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class fh extends mt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new on,this.environmentIntensity=1,this.environmentRotation=new on,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class ph{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=ya,this.updateRanges=[],this.version=0,this.uuid=In()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[n+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=In()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=In()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Rt=new L;class Fs{constructor(e,t,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix4(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyNormalMatrix(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.transformDirection(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=Qt(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=Qt(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=Qt(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=Qt(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=Qt(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),s=Je(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),s=Je(s,this.array),r=Je(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Ns("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new Wt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new Fs(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Ns("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Ol extends jn{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new ze(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let ui;const Fi=new L,di=new L,fi=new L,pi=new Pe,Oi=new Pe,Bl=new rt,_s=new L,Bi=new L,xs=new L,Ro=new Pe,Mr=new Pe,Co=new Pe;class mh extends mt{constructor(e=new Ol){if(super(),this.isSprite=!0,this.type="Sprite",ui===void 0){ui=new Pt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new ph(t,5);ui.setIndex([0,1,2,0,2,3]),ui.setAttribute("position",new Fs(n,3,0,!1)),ui.setAttribute("uv",new Fs(n,2,3,!1))}this.geometry=ui,this.material=e,this.center=new Pe(.5,.5),this.count=1}raycast(e,t){e.camera===null&&Ve('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),di.setFromMatrixScale(this.matrixWorld),Bl.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),fi.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&di.multiplyScalar(-fi.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const a=this.center;vs(_s.set(-.5,-.5,0),fi,a,di,s,r),vs(Bi.set(.5,-.5,0),fi,a,di,s,r),vs(xs.set(.5,.5,0),fi,a,di,s,r),Ro.set(0,0),Mr.set(1,0),Co.set(1,1);let o=e.ray.intersectTriangle(_s,Bi,xs,!1,Fi);if(o===null&&(vs(Bi.set(-.5,.5,0),fi,a,di,s,r),Mr.set(0,1),o=e.ray.intersectTriangle(_s,xs,Bi,!1,Fi),o===null))return;const l=e.ray.origin.distanceTo(Fi);l<e.near||l>e.far||t.push({distance:l,point:Fi.clone(),uv:Ht.getInterpolation(Fi,_s,Bi,xs,Ro,Mr,Co,new Pe),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function vs(i,e,t,n,s,r){pi.subVectors(i,t).addScalar(.5).multiply(n),s!==void 0?(Oi.x=r*pi.x-s*pi.y,Oi.y=s*pi.x+r*pi.y):Oi.copy(pi),i.copy(e),i.x+=Oi.x,i.y+=Oi.y,i.applyMatrix4(Bl)}class gh extends Et{constructor(e=null,t=1,n=1,s,r,a,o,l,c=yt,h=yt,u,d){super(null,a,o,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Sr=new L,_h=new L,xh=new De;class Cn{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=Sr.subVectors(n,t).cross(_h.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(Sr),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||xh.getNormalMatrix(e),s=this.coplanarPoint(Sr).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const kn=new zs,vh=new Pe(.5,.5),Ms=new L;class Ha{constructor(e=new Cn,t=new Cn,n=new Cn,s=new Cn,r=new Cn,a=new Cn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=tn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],u=r[5],d=r[6],p=r[7],_=r[8],M=r[9],m=r[10],f=r[11],y=r[12],b=r[13],E=r[14],w=r[15];if(s[0].setComponents(c-a,p-h,f-_,w-y).normalize(),s[1].setComponents(c+a,p+h,f+_,w+y).normalize(),s[2].setComponents(c+o,p+u,f+M,w+b).normalize(),s[3].setComponents(c-o,p-u,f-M,w-b).normalize(),n)s[4].setComponents(l,d,m,E).normalize(),s[5].setComponents(c-l,p-d,f-m,w-E).normalize();else if(s[4].setComponents(c-l,p-d,f-m,w-E).normalize(),t===tn)s[5].setComponents(c+l,p+d,f+m,w+E).normalize();else if(t===Us)s[5].setComponents(l,d,m,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),kn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),kn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(kn)}intersectsSprite(e){kn.center.set(0,0,0);const t=vh.distanceTo(e.center);return kn.radius=.7071067811865476+t,kn.applyMatrix4(e.matrixWorld),this.intersectsSphere(kn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Ms.x=s.normal.x>0?e.max.x:e.min.x,Ms.y=s.normal.y>0?e.max.y:e.min.y,Ms.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ms)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class zl extends jn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ze(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Po=new rt,Ta=new ka,Ss=new zs,ys=new L;class Mh extends mt{constructor(e=new Pt,t=new zl){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ss.copy(n.boundingSphere),Ss.applyMatrix4(s),Ss.radius+=r,e.ray.intersectsSphere(Ss)===!1)return;Po.copy(s).invert(),Ta.copy(e.ray).applyMatrix4(Po);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),p=Math.min(c.count,a.start+a.count);for(let _=d,M=p;_<M;_++){const m=c.getX(_);ys.fromBufferAttribute(u,m),Lo(ys,m,l,s,e,t,this)}}else{const d=Math.max(0,a.start),p=Math.min(u.count,a.start+a.count);for(let _=d,M=p;_<M;_++)ys.fromBufferAttribute(u,_),Lo(ys,_,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Lo(i,e,t,n,s,r,a){const o=Ta.distanceSqToPoint(i);if(o<t){const l=new L;Ta.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class kl extends Et{constructor(e,t,n,s,r,a,o,l,c){super(e,t,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class $i extends Et{constructor(e,t,n=an,s,r,a,o=yt,l=yt,c,h=Sn,u=1){if(h!==Sn&&h!==qn)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:u};super(d,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new za(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Sh extends $i{constructor(e,t=an,n=Kn,s,r,a=yt,o=yt,l,c=Sn){const h={width:e,height:e,depth:1},u=[h,h,h,h,h,h];super(e,e,t,n,s,r,a,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Vl extends Et{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class ks extends Pt{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],u=[],d=[],p=[];let _=0;const M=[],m=n/2;let f=0;y(),a===!1&&(e>0&&b(!0),t>0&&b(!1)),this.setIndex(h),this.setAttribute("position",new St(u,3)),this.setAttribute("normal",new St(d,3)),this.setAttribute("uv",new St(p,2));function y(){const E=new L,w=new L;let A=0;const R=(t-e)/n;for(let I=0;I<=r;I++){const x=[],S=I/r,P=S*(t-e)+e;for(let O=0;O<=s;O++){const B=O/s,X=B*l+o,W=Math.sin(X),G=Math.cos(X);w.x=P*W,w.y=-S*n+m,w.z=P*G,u.push(w.x,w.y,w.z),E.set(W,R,G).normalize(),d.push(E.x,E.y,E.z),p.push(B,1-S),x.push(_++)}M.push(x)}for(let I=0;I<s;I++)for(let x=0;x<r;x++){const S=M[x][I],P=M[x+1][I],O=M[x+1][I+1],B=M[x][I+1];(e>0||x!==0)&&(h.push(S,P,B),A+=3),(t>0||x!==r-1)&&(h.push(P,O,B),A+=3)}c.addGroup(f,A,0),f+=A}function b(E){const w=_,A=new Pe,R=new L;let I=0;const x=E===!0?e:t,S=E===!0?1:-1;for(let O=1;O<=s;O++)u.push(0,m*S,0),d.push(0,S,0),p.push(.5,.5),_++;const P=_;for(let O=0;O<=s;O++){const X=O/s*l+o,W=Math.cos(X),G=Math.sin(X);R.x=x*G,R.y=m*S,R.z=x*W,u.push(R.x,R.y,R.z),d.push(0,S,0),A.x=W*.5+.5,A.y=G*.5*S+.5,p.push(A.x,A.y),_++}for(let O=0;O<s;O++){const B=w+O,X=P+O;E===!0?h.push(X,X+1,B):h.push(X+1,X,B),I+=3}c.addGroup(f,I,E===!0?1:2),f+=I}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ks(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Vs extends ks{constructor(e=1,t=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,e,t,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Vs(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Ci extends Pt{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new St(r,3)),this.setAttribute("normal",new St(r.slice(),3)),this.setAttribute("uv",new St(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(y){const b=new L,E=new L,w=new L;for(let A=0;A<t.length;A+=3)p(t[A+0],b),p(t[A+1],E),p(t[A+2],w),l(b,E,w,y)}function l(y,b,E,w){const A=w+1,R=[];for(let I=0;I<=A;I++){R[I]=[];const x=y.clone().lerp(E,I/A),S=b.clone().lerp(E,I/A),P=A-I;for(let O=0;O<=P;O++)O===0&&I===A?R[I][O]=x:R[I][O]=x.clone().lerp(S,O/P)}for(let I=0;I<A;I++)for(let x=0;x<2*(A-I)-1;x++){const S=Math.floor(x/2);x%2===0?(d(R[I][S+1]),d(R[I+1][S]),d(R[I][S])):(d(R[I][S+1]),d(R[I+1][S+1]),d(R[I+1][S]))}}function c(y){const b=new L;for(let E=0;E<r.length;E+=3)b.x=r[E+0],b.y=r[E+1],b.z=r[E+2],b.normalize().multiplyScalar(y),r[E+0]=b.x,r[E+1]=b.y,r[E+2]=b.z}function h(){const y=new L;for(let b=0;b<r.length;b+=3){y.x=r[b+0],y.y=r[b+1],y.z=r[b+2];const E=m(y)/2/Math.PI+.5,w=f(y)/Math.PI+.5;a.push(E,1-w)}_(),u()}function u(){for(let y=0;y<a.length;y+=6){const b=a[y+0],E=a[y+2],w=a[y+4],A=Math.max(b,E,w),R=Math.min(b,E,w);A>.9&&R<.1&&(b<.2&&(a[y+0]+=1),E<.2&&(a[y+2]+=1),w<.2&&(a[y+4]+=1))}}function d(y){r.push(y.x,y.y,y.z)}function p(y,b){const E=y*3;b.x=e[E+0],b.y=e[E+1],b.z=e[E+2]}function _(){const y=new L,b=new L,E=new L,w=new L,A=new Pe,R=new Pe,I=new Pe;for(let x=0,S=0;x<r.length;x+=9,S+=6){y.set(r[x+0],r[x+1],r[x+2]),b.set(r[x+3],r[x+4],r[x+5]),E.set(r[x+6],r[x+7],r[x+8]),A.set(a[S+0],a[S+1]),R.set(a[S+2],a[S+3]),I.set(a[S+4],a[S+5]),w.copy(y).add(b).add(E).divideScalar(3);const P=m(w);M(A,S+0,y,P),M(R,S+2,b,P),M(I,S+4,E,P)}}function M(y,b,E,w){w<0&&y.x===1&&(a[b]=y.x-1),E.x===0&&E.z===0&&(a[b]=w/2/Math.PI+.5)}function m(y){return Math.atan2(y.z,-y.x)}function f(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ci(e.vertices,e.indices,e.radius,e.detail)}}class Wa extends Ci{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-s,-n,0,-s,n,0,s,-n,0,s,n,-s,-n,0,-s,n,0,s,-n,0,s,n,0,-n,0,-s,n,0,-s,-n,0,s,n,0,s],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Wa(e.radius,e.detail)}}class Xa extends Ci{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Xa(e.radius,e.detail)}}class Gs extends Ci{constructor(e=1,t=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Gs(e.radius,e.detail)}}class bi extends Pt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=e/o,d=t/l,p=[],_=[],M=[],m=[];for(let f=0;f<h;f++){const y=f*d-a;for(let b=0;b<c;b++){const E=b*u-r;_.push(E,-y,0),M.push(0,0,1),m.push(b/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let y=0;y<o;y++){const b=y+c*f,E=y+c*(f+1),w=y+1+c*(f+1),A=y+1+c*f;p.push(b,E,A),p.push(E,w,A)}this.setIndex(p),this.setAttribute("position",new St(_,3)),this.setAttribute("normal",new St(M,3)),this.setAttribute("uv",new St(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new bi(e.width,e.height,e.widthSegments,e.heightSegments)}}class xi extends Ci{constructor(e=1,t=0){const n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],s=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,s,e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new xi(e.radius,e.detail)}}class wi extends Pt{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const a=[],o=[],l=[],c=[],h=new L,u=new L,d=new L;for(let p=0;p<=n;p++)for(let _=0;_<=s;_++){const M=_/s*r,m=p/n*Math.PI*2;u.x=(e+t*Math.cos(m))*Math.cos(M),u.y=(e+t*Math.cos(m))*Math.sin(M),u.z=t*Math.sin(m),o.push(u.x,u.y,u.z),h.x=e*Math.cos(M),h.y=e*Math.sin(M),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(_/s),c.push(p/n)}for(let p=1;p<=n;p++)for(let _=1;_<=s;_++){const M=(s+1)*p+_-1,m=(s+1)*(p-1)+_-1,f=(s+1)*(p-1)+_,y=(s+1)*p+_;a.push(M,m,y),a.push(m,f,y)}this.setIndex(a),this.setAttribute("position",new St(o,3)),this.setAttribute("normal",new St(l,3)),this.setAttribute("uv",new St(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new wi(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class yh extends ln{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class vi extends jn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new ze(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ze(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Al,this.normalScale=new Pe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Eh extends jn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ic,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Th extends jn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const yr={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(this.files[i]=e)},get:function(i){if(this.enabled!==!1)return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};class Gl{constructor(e,t,n){const s=this;let r=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){const u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){const p=c[u],_=c[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return _}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}}const bh=new Gl;class qa{constructor(e){this.manager=e!==void 0?e:bh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const n=this;return new Promise(function(s,r){n.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}qa.DEFAULT_MATERIAL_NAME="__DEFAULT";const mi=new WeakMap;class wh extends qa{constructor(e){super(e)}load(e,t,n,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=yr.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0);else{let u=mi.get(a);u===void 0&&(u=[],mi.set(a,u)),u.push({onLoad:t,onError:s})}return a}const o=qi("img");function l(){h(),t&&t(this);const u=mi.get(this)||[];for(let d=0;d<u.length;d++){const p=u[d];p.onLoad&&p.onLoad(this)}mi.delete(this),r.manager.itemEnd(e)}function c(u){h(),s&&s(u),yr.remove(`image:${e}`);const d=mi.get(this)||[];for(let p=0;p<d.length;p++){const _=d[p];_.onError&&_.onError(u)}mi.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),yr.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class Ah extends qa{constructor(e){super(e)}load(e,t,n,s){const r=new Et,a=new wh(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){r.image=o,r.needsUpdate=!0,t!==void 0&&t(r)},n,s),r}}class Ya extends mt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ze(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}class Rh extends Ya{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(mt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ze(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}}const Er=new rt,Do=new L,Io=new L;class Hl{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Pe(512,512),this.mapType=kt,this.map=null,this.mapPass=null,this.matrix=new rt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ha,this._frameExtents=new Pe(1,1),this._viewportCount=1,this._viewports=[new ht(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;Do.setFromMatrixPosition(e.matrixWorld),t.position.copy(Do),Io.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Io),t.updateMatrixWorld(),Er.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Er,t.coordinateSystem,t.reversedDepth),t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Er)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Ch extends Hl{constructor(){super(new zt(90,1,.5,500)),this.isPointLightShadow=!0}}class Uo extends Ya{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new Ch}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class $a extends Ul{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class Ph extends Hl{constructor(){super(new $a(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Lh extends Ya{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(mt.DEFAULT_UP),this.updateMatrix(),this.target=new mt,this.shadow=new Ph}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class Dh extends zt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const No=new rt;class Ih{constructor(e,t,n=0,s=1/0){this.ray=new ka(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new Va,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ve("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return No.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(No),this}intersectObject(e,t=!0,n=[]){return ba(e,this,n,t),n.sort(Fo),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)ba(e[s],this,n,t);return n.sort(Fo),n}}function Fo(i,e){return i.distance-e.distance}function ba(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let a=0,o=r.length;a<o;a++)ba(r[a],e,t,!0)}}function Oo(i,e,t,n){const s=Uh(n);switch(t){case Tl:return i*e;case wl:return i*e/s.components*s.byteLength;case Ua:return i*e/s.components*s.byteLength;case yi:return i*e*2/s.components*s.byteLength;case Na:return i*e*2/s.components*s.byteLength;case bl:return i*e*3/s.components*s.byteLength;case $t:return i*e*4/s.components*s.byteLength;case Fa:return i*e*4/s.components*s.byteLength;case Rs:case Cs:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Ps:case Ls:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Xr:case Yr:return Math.max(i,16)*Math.max(e,8)/4;case Wr:case qr:return Math.max(i,8)*Math.max(e,8)/2;case $r:case Kr:case Zr:case Jr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case jr:case Qr:case ea:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case ta:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case na:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case ia:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case sa:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case ra:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case aa:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case oa:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case la:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case ca:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case ha:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case ua:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case da:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case fa:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case pa:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case ma:case ga:case _a:return Math.ceil(i/4)*Math.ceil(e/4)*16;case xa:case va:return Math.ceil(i/4)*Math.ceil(e/4)*8;case Ma:case Sa:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Uh(i){switch(i){case kt:case Ml:return{byteLength:1,components:1};case Wi:case Sl:case Mn:return{byteLength:2,components:1};case Da:case Ia:return{byteLength:2,components:4};case an:case La:case en:return{byteLength:4,components:1};case yl:case El:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ca}}));typeof window<"u"&&(window.__THREE__?Ce("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ca);function Wl(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Nh(i){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((p,_)=>p.start-_.start);let d=0;for(let p=1;p<u.length;p++){const _=u[d],M=u[p];M.start<=_.start+_.count+1?_.count=Math.max(_.count,M.start+M.count-_.start):(++d,u[d]=M)}u.length=d+1;for(let p=0,_=u.length;p<_;p++){const M=u[p];i.bufferSubData(c,M.start*h.BYTES_PER_ELEMENT,h,M.start,M.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Fh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Oh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Bh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,zh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,kh=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Vh=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Gh=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Hh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Wh=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Xh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,qh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Yh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,$h=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Kh=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,jh=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Zh=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Jh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Qh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,eu=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,tu=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,nu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,iu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,su=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,ru=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,au=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,ou=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,lu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,cu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,hu=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,uu=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,du="gl_FragColor = linearToOutputTexel( gl_FragColor );",fu=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,pu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,mu=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,gu=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,_u=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,xu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,vu=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Mu=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Su=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,yu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Eu=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Tu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,bu=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,wu=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Au=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Ru=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Cu=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Pu=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Lu=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Du=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Iu=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Uu=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return v;
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( vec3( 1.0 ) - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Nu=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Fu=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Ou=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Bu=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,zu=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ku=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Vu=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Gu=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Hu=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Wu=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Xu=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,qu=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Yu=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,$u=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Ku=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,ju=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Zu=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Ju=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Qu=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ed=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,td=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,nd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,id=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,sd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,rd=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ad=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,od=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,ld=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,cd=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,hd=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,ud=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,dd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,fd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,pd=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,md=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,gd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,_d=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * 6.28318530718;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * 6.28318530718;
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * vogelDiskSample( 0, 5, phi ).x + bitangent * vogelDiskSample( 0, 5, phi ).y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * vogelDiskSample( 1, 5, phi ).x + bitangent * vogelDiskSample( 1, 5, phi ).y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * vogelDiskSample( 2, 5, phi ).x + bitangent * vogelDiskSample( 2, 5, phi ).y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * vogelDiskSample( 3, 5, phi ).x + bitangent * vogelDiskSample( 3, 5, phi ).y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * vogelDiskSample( 4, 5, phi ).x + bitangent * vogelDiskSample( 4, 5, phi ).y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadow = step( depth, dp );
			#else
				shadow = step( dp, depth );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,xd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,vd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Md=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Sd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,yd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Ed=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Td=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,bd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,wd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Ad=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Rd=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Cd=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Pd=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ld=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Dd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Id=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Ud=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Nd=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Fd=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Od=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Bd=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,kd=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Vd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Gd=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Hd=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Wd=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Xd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,qd=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yd=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,$d=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Kd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,jd=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Zd=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Jd=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Qd=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,ef=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,nf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,sf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,af=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,of=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,cf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,hf=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,uf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,df=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ff=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,pf=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,mf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ie={alphahash_fragment:Fh,alphahash_pars_fragment:Oh,alphamap_fragment:Bh,alphamap_pars_fragment:zh,alphatest_fragment:kh,alphatest_pars_fragment:Vh,aomap_fragment:Gh,aomap_pars_fragment:Hh,batching_pars_vertex:Wh,batching_vertex:Xh,begin_vertex:qh,beginnormal_vertex:Yh,bsdfs:$h,iridescence_fragment:Kh,bumpmap_pars_fragment:jh,clipping_planes_fragment:Zh,clipping_planes_pars_fragment:Jh,clipping_planes_pars_vertex:Qh,clipping_planes_vertex:eu,color_fragment:tu,color_pars_fragment:nu,color_pars_vertex:iu,color_vertex:su,common:ru,cube_uv_reflection_fragment:au,defaultnormal_vertex:ou,displacementmap_pars_vertex:lu,displacementmap_vertex:cu,emissivemap_fragment:hu,emissivemap_pars_fragment:uu,colorspace_fragment:du,colorspace_pars_fragment:fu,envmap_fragment:pu,envmap_common_pars_fragment:mu,envmap_pars_fragment:gu,envmap_pars_vertex:_u,envmap_physical_pars_fragment:Ru,envmap_vertex:xu,fog_vertex:vu,fog_pars_vertex:Mu,fog_fragment:Su,fog_pars_fragment:yu,gradientmap_pars_fragment:Eu,lightmap_pars_fragment:Tu,lights_lambert_fragment:bu,lights_lambert_pars_fragment:wu,lights_pars_begin:Au,lights_toon_fragment:Cu,lights_toon_pars_fragment:Pu,lights_phong_fragment:Lu,lights_phong_pars_fragment:Du,lights_physical_fragment:Iu,lights_physical_pars_fragment:Uu,lights_fragment_begin:Nu,lights_fragment_maps:Fu,lights_fragment_end:Ou,logdepthbuf_fragment:Bu,logdepthbuf_pars_fragment:zu,logdepthbuf_pars_vertex:ku,logdepthbuf_vertex:Vu,map_fragment:Gu,map_pars_fragment:Hu,map_particle_fragment:Wu,map_particle_pars_fragment:Xu,metalnessmap_fragment:qu,metalnessmap_pars_fragment:Yu,morphinstance_vertex:$u,morphcolor_vertex:Ku,morphnormal_vertex:ju,morphtarget_pars_vertex:Zu,morphtarget_vertex:Ju,normal_fragment_begin:Qu,normal_fragment_maps:ed,normal_pars_fragment:td,normal_pars_vertex:nd,normal_vertex:id,normalmap_pars_fragment:sd,clearcoat_normal_fragment_begin:rd,clearcoat_normal_fragment_maps:ad,clearcoat_pars_fragment:od,iridescence_pars_fragment:ld,opaque_fragment:cd,packing:hd,premultiplied_alpha_fragment:ud,project_vertex:dd,dithering_fragment:fd,dithering_pars_fragment:pd,roughnessmap_fragment:md,roughnessmap_pars_fragment:gd,shadowmap_pars_fragment:_d,shadowmap_pars_vertex:xd,shadowmap_vertex:vd,shadowmask_pars_fragment:Md,skinbase_vertex:Sd,skinning_pars_vertex:yd,skinning_vertex:Ed,skinnormal_vertex:Td,specularmap_fragment:bd,specularmap_pars_fragment:wd,tonemapping_fragment:Ad,tonemapping_pars_fragment:Rd,transmission_fragment:Cd,transmission_pars_fragment:Pd,uv_pars_fragment:Ld,uv_pars_vertex:Dd,uv_vertex:Id,worldpos_vertex:Ud,background_vert:Nd,background_frag:Fd,backgroundCube_vert:Od,backgroundCube_frag:Bd,cube_vert:zd,cube_frag:kd,depth_vert:Vd,depth_frag:Gd,distance_vert:Hd,distance_frag:Wd,equirect_vert:Xd,equirect_frag:qd,linedashed_vert:Yd,linedashed_frag:$d,meshbasic_vert:Kd,meshbasic_frag:jd,meshlambert_vert:Zd,meshlambert_frag:Jd,meshmatcap_vert:Qd,meshmatcap_frag:ef,meshnormal_vert:tf,meshnormal_frag:nf,meshphong_vert:sf,meshphong_frag:rf,meshphysical_vert:af,meshphysical_frag:of,meshtoon_vert:lf,meshtoon_frag:cf,points_vert:hf,points_frag:uf,shadow_vert:df,shadow_frag:ff,sprite_vert:pf,sprite_frag:mf},oe={common:{diffuse:{value:new ze(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new De},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new De}},envmap:{envMap:{value:null},envMapRotation:{value:new De},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new De}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new De}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new De},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new De},normalScale:{value:new Pe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new De},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new De}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new De}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new De}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ze(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ze(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0},uvTransform:{value:new De}},sprite:{diffuse:{value:new ze(16777215)},opacity:{value:1},center:{value:new Pe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new De},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0}}},Jt={basic:{uniforms:Ct([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.fog]),vertexShader:Ie.meshbasic_vert,fragmentShader:Ie.meshbasic_frag},lambert:{uniforms:Ct([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new ze(0)}}]),vertexShader:Ie.meshlambert_vert,fragmentShader:Ie.meshlambert_frag},phong:{uniforms:Ct([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new ze(0)},specular:{value:new ze(1118481)},shininess:{value:30}}]),vertexShader:Ie.meshphong_vert,fragmentShader:Ie.meshphong_frag},standard:{uniforms:Ct([oe.common,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.roughnessmap,oe.metalnessmap,oe.fog,oe.lights,{emissive:{value:new ze(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag},toon:{uniforms:Ct([oe.common,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.gradientmap,oe.fog,oe.lights,{emissive:{value:new ze(0)}}]),vertexShader:Ie.meshtoon_vert,fragmentShader:Ie.meshtoon_frag},matcap:{uniforms:Ct([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,{matcap:{value:null}}]),vertexShader:Ie.meshmatcap_vert,fragmentShader:Ie.meshmatcap_frag},points:{uniforms:Ct([oe.points,oe.fog]),vertexShader:Ie.points_vert,fragmentShader:Ie.points_frag},dashed:{uniforms:Ct([oe.common,oe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ie.linedashed_vert,fragmentShader:Ie.linedashed_frag},depth:{uniforms:Ct([oe.common,oe.displacementmap]),vertexShader:Ie.depth_vert,fragmentShader:Ie.depth_frag},normal:{uniforms:Ct([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,{opacity:{value:1}}]),vertexShader:Ie.meshnormal_vert,fragmentShader:Ie.meshnormal_frag},sprite:{uniforms:Ct([oe.sprite,oe.fog]),vertexShader:Ie.sprite_vert,fragmentShader:Ie.sprite_frag},background:{uniforms:{uvTransform:{value:new De},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ie.background_vert,fragmentShader:Ie.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new De}},vertexShader:Ie.backgroundCube_vert,fragmentShader:Ie.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ie.cube_vert,fragmentShader:Ie.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ie.equirect_vert,fragmentShader:Ie.equirect_frag},distance:{uniforms:Ct([oe.common,oe.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ie.distance_vert,fragmentShader:Ie.distance_frag},shadow:{uniforms:Ct([oe.lights,oe.fog,{color:{value:new ze(0)},opacity:{value:1}}]),vertexShader:Ie.shadow_vert,fragmentShader:Ie.shadow_frag}};Jt.physical={uniforms:Ct([Jt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new De},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new De},clearcoatNormalScale:{value:new Pe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new De},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new De},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new De},sheen:{value:0},sheenColor:{value:new ze(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new De},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new De},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new De},transmissionSamplerSize:{value:new Pe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new De},attenuationDistance:{value:0},attenuationColor:{value:new ze(0)},specularColor:{value:new ze(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new De},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new De},anisotropyVector:{value:new Pe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new De}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag};const Es={r:0,b:0,g:0},Vn=new on,gf=new rt;function _f(i,e,t,n,s,r,a){const o=new ze(0);let l=r===!0?0:1,c,h,u=null,d=0,p=null;function _(b){let E=b.isScene===!0?b.background:null;return E&&E.isTexture&&(E=(b.backgroundBlurriness>0?t:e).get(E)),E}function M(b){let E=!1;const w=_(b);w===null?f(o,l):w&&w.isColor&&(f(w,1),E=!0);const A=i.xr.getEnvironmentBlendMode();A==="additive"?n.buffers.color.setClear(0,0,0,1,a):A==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||E)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(b,E){const w=_(E);w&&(w.isCubeTexture||w.mapping===Bs)?(h===void 0&&(h=new ot(new yn(1,1,1),new ln({name:"BackgroundCubeMaterial",uniforms:Ti(Jt.backgroundCube.uniforms),vertexShader:Jt.backgroundCube.vertexShader,fragmentShader:Jt.backgroundCube.fragmentShader,side:It,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(A,R,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),Vn.copy(E.backgroundRotation),Vn.x*=-1,Vn.y*=-1,Vn.z*=-1,w.isCubeTexture&&w.isRenderTargetTexture===!1&&(Vn.y*=-1,Vn.z*=-1),h.material.uniforms.envMap.value=w,h.material.uniforms.flipEnvMap.value=w.isCubeTexture&&w.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(gf.makeRotationFromEuler(Vn)),h.material.toneMapped=He.getTransfer(w.colorSpace)!==je,(u!==w||d!==w.version||p!==i.toneMapping)&&(h.material.needsUpdate=!0,u=w,d=w.version,p=i.toneMapping),h.layers.enableAll(),b.unshift(h,h.geometry,h.material,0,0,null)):w&&w.isTexture&&(c===void 0&&(c=new ot(new bi(2,2),new ln({name:"BackgroundMaterial",uniforms:Ti(Jt.background.uniforms),vertexShader:Jt.background.vertexShader,fragmentShader:Jt.background.fragmentShader,side:Un,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=w,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.toneMapped=He.getTransfer(w.colorSpace)!==je,w.matrixAutoUpdate===!0&&w.updateMatrix(),c.material.uniforms.uvTransform.value.copy(w.matrix),(u!==w||d!==w.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,u=w,d=w.version,p=i.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null))}function f(b,E){b.getRGB(Es,Il(i)),n.buffers.color.setClear(Es.r,Es.g,Es.b,E,a)}function y(){h!==void 0&&(h.geometry.dispose(),h.material.dispose(),h=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(b,E=1){o.set(b),l=E,f(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(b){l=b,f(o,l)},render:M,addToRenderList:m,dispose:y}}function xf(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(S,P,O,B,X){let W=!1;const G=u(B,O,P);r!==G&&(r=G,c(r.object)),W=p(S,B,O,X),W&&_(S,B,O,X),X!==null&&e.update(X,i.ELEMENT_ARRAY_BUFFER),(W||a)&&(a=!1,E(S,P,O,B),X!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(X).buffer))}function l(){return i.createVertexArray()}function c(S){return i.bindVertexArray(S)}function h(S){return i.deleteVertexArray(S)}function u(S,P,O){const B=O.wireframe===!0;let X=n[S.id];X===void 0&&(X={},n[S.id]=X);let W=X[P.id];W===void 0&&(W={},X[P.id]=W);let G=W[B];return G===void 0&&(G=d(l()),W[B]=G),G}function d(S){const P=[],O=[],B=[];for(let X=0;X<t;X++)P[X]=0,O[X]=0,B[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:O,attributeDivisors:B,object:S,attributes:{},index:null}}function p(S,P,O,B){const X=r.attributes,W=P.attributes;let G=0;const V=O.getAttributes();for(const j in V)if(V[j].location>=0){const ae=X[j];let ue=W[j];if(ue===void 0&&(j==="instanceMatrix"&&S.instanceMatrix&&(ue=S.instanceMatrix),j==="instanceColor"&&S.instanceColor&&(ue=S.instanceColor)),ae===void 0||ae.attribute!==ue||ue&&ae.data!==ue.data)return!0;G++}return r.attributesNum!==G||r.index!==B}function _(S,P,O,B){const X={},W=P.attributes;let G=0;const V=O.getAttributes();for(const j in V)if(V[j].location>=0){let ae=W[j];ae===void 0&&(j==="instanceMatrix"&&S.instanceMatrix&&(ae=S.instanceMatrix),j==="instanceColor"&&S.instanceColor&&(ae=S.instanceColor));const ue={};ue.attribute=ae,ae&&ae.data&&(ue.data=ae.data),X[j]=ue,G++}r.attributes=X,r.attributesNum=G,r.index=B}function M(){const S=r.newAttributes;for(let P=0,O=S.length;P<O;P++)S[P]=0}function m(S){f(S,0)}function f(S,P){const O=r.newAttributes,B=r.enabledAttributes,X=r.attributeDivisors;O[S]=1,B[S]===0&&(i.enableVertexAttribArray(S),B[S]=1),X[S]!==P&&(i.vertexAttribDivisor(S,P),X[S]=P)}function y(){const S=r.newAttributes,P=r.enabledAttributes;for(let O=0,B=P.length;O<B;O++)P[O]!==S[O]&&(i.disableVertexAttribArray(O),P[O]=0)}function b(S,P,O,B,X,W,G){G===!0?i.vertexAttribIPointer(S,P,O,X,W):i.vertexAttribPointer(S,P,O,B,X,W)}function E(S,P,O,B){M();const X=B.attributes,W=O.getAttributes(),G=P.defaultAttributeValues;for(const V in W){const j=W[V];if(j.location>=0){let he=X[V];if(he===void 0&&(V==="instanceMatrix"&&S.instanceMatrix&&(he=S.instanceMatrix),V==="instanceColor"&&S.instanceColor&&(he=S.instanceColor)),he!==void 0){const ae=he.normalized,ue=he.itemSize,Oe=e.get(he);if(Oe===void 0)continue;const Ue=Oe.buffer,at=Oe.type,st=Oe.bytesPerElement,Y=at===i.INT||at===i.UNSIGNED_INT||he.gpuType===La;if(he.isInterleavedBufferAttribute){const Z=he.data,pe=Z.stride,Le=he.offset;if(Z.isInstancedInterleavedBuffer){for(let _e=0;_e<j.locationSize;_e++)f(j.location+_e,Z.meshPerAttribute);S.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=Z.meshPerAttribute*Z.count)}else for(let _e=0;_e<j.locationSize;_e++)m(j.location+_e);i.bindBuffer(i.ARRAY_BUFFER,Ue);for(let _e=0;_e<j.locationSize;_e++)b(j.location+_e,ue/j.locationSize,at,ae,pe*st,(Le+ue/j.locationSize*_e)*st,Y)}else{if(he.isInstancedBufferAttribute){for(let Z=0;Z<j.locationSize;Z++)f(j.location+Z,he.meshPerAttribute);S.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=he.meshPerAttribute*he.count)}else for(let Z=0;Z<j.locationSize;Z++)m(j.location+Z);i.bindBuffer(i.ARRAY_BUFFER,Ue);for(let Z=0;Z<j.locationSize;Z++)b(j.location+Z,ue/j.locationSize,at,ae,ue*st,ue/j.locationSize*Z*st,Y)}}else if(G!==void 0){const ae=G[V];if(ae!==void 0)switch(ae.length){case 2:i.vertexAttrib2fv(j.location,ae);break;case 3:i.vertexAttrib3fv(j.location,ae);break;case 4:i.vertexAttrib4fv(j.location,ae);break;default:i.vertexAttrib1fv(j.location,ae)}}}}y()}function w(){I();for(const S in n){const P=n[S];for(const O in P){const B=P[O];for(const X in B)h(B[X].object),delete B[X];delete P[O]}delete n[S]}}function A(S){if(n[S.id]===void 0)return;const P=n[S.id];for(const O in P){const B=P[O];for(const X in B)h(B[X].object),delete B[X];delete P[O]}delete n[S.id]}function R(S){for(const P in n){const O=n[P];if(O[S.id]===void 0)continue;const B=O[S.id];for(const X in B)h(B[X].object),delete B[X];delete O[S.id]}}function I(){x(),a=!0,r!==s&&(r=s,c(r.object))}function x(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:I,resetDefaultState:x,dispose:w,releaseStatesOfGeometry:A,releaseStatesOfProgram:R,initAttributes:M,enableAttribute:m,disableUnusedAttributes:y}}function vf(i,e,t){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),t.update(h,n,1)}function a(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),t.update(h,n,u))}function o(c,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let p=0;for(let _=0;_<u;_++)p+=h[_];t.update(p,n,1)}function l(c,h,u,d){if(u===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let _=0;_<c.length;_++)a(c[_],h[_],d[_]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let _=0;for(let M=0;M<u;M++)_+=h[M]*d[M];t.update(_,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Mf(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==$t&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const I=R===Mn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==kt&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==en&&!I)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(Ce("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),f=i.getParameter(i.MAX_VERTEX_ATTRIBS),y=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),E=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),w=i.getParameter(i.MAX_SAMPLES),A=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:d,maxTextures:p,maxVertexTextures:_,maxTextureSize:M,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:y,maxVaryings:b,maxFragmentUniforms:E,maxSamples:w,samples:A}}function Sf(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Cn,o=new De,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||n!==0||s;return s=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,p){const _=u.clippingPlanes,M=u.clipIntersection,m=u.clipShadows,f=i.get(u);if(!s||_===null||_.length===0||r&&!m)r?h(null):c();else{const y=r?0:n,b=y*4;let E=f.clippingState||null;l.value=E,E=h(_,d,b,p);for(let w=0;w!==b;++w)E[w]=t[w];f.clippingState=E,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,p,_){const M=u!==null?u.length:0;let m=null;if(M!==0){if(m=l.value,_!==!0||m===null){const f=p+M*4,y=d.matrixWorldInverse;o.getNormalMatrix(y),(m===null||m.length<f)&&(m=new Float32Array(f));for(let b=0,E=p;b!==M;++b,E+=4)a.copy(u[b]).applyMatrix4(y,o),a.normal.toArray(m,E),m[E+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=M,e.numIntersection=0,m}}function yf(i){let e=new WeakMap;function t(a,o){return o===kr?a.mapping=Kn:o===Vr&&(a.mapping=Si),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===kr||o===Vr)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Fl(l.height);return c.fromEquirectangularTexture(i,a),e.set(a,c),a.addEventListener("dispose",s),t(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}const Ln=4,Bo=[.125,.215,.35,.446,.526,.582],Wn=20,Ef=256,zi=new $a,zo=new ze;let Tr=null,br=0,wr=0,Ar=!1;const Tf=new L;class ko{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=Tf}=r;Tr=this._renderer.getRenderTarget(),br=this._renderer.getActiveCubeFace(),wr=this._renderer.getActiveMipmapLevel(),Ar=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ho(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Go(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Tr,br,wr),this._renderer.xr.enabled=Ar,e.scissorTest=!1,gi(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Kn||e.mapping===Si?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Tr=this._renderer.getRenderTarget(),br=this._renderer.getActiveCubeFace(),wr=this._renderer.getActiveMipmapLevel(),Ar=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:wt,minFilter:wt,generateMipmaps:!1,type:Mn,format:$t,colorSpace:Ei,depthBuffer:!1},s=Vo(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Vo(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=bf(r)),this._blurMaterial=Af(r,e,t),this._ggxMaterial=wf(r,e,t)}return s}_compileMaterial(e){const t=new ot(new Pt,e);this._renderer.compile(t,zi)}_sceneToCubeUV(e,t,n,s,r){const l=new zt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,p=u.toneMapping;u.getClearColor(zo),u.toneMapping=sn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(s),u.clearDepth(),u.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ot(new yn,new nn({name:"PMREM.Background",side:It,depthWrite:!1,depthTest:!1})));const M=this._backgroundBox,m=M.material;let f=!1;const y=e.background;y?y.isColor&&(m.color.copy(y),e.background=null,f=!0):(m.color.copy(zo),f=!0);for(let b=0;b<6;b++){const E=b%3;E===0?(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[b],r.y,r.z)):E===1?(l.up.set(0,0,c[b]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[b],r.z)):(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[b]));const w=this._cubeSize;gi(s,E*w,b>2?w:0,w,w),u.setRenderTarget(s),f&&u.render(M,l),u.render(e,l)}u.toneMapping=p,u.autoClear=d,e.background=y}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Kn||e.mapping===Si;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ho()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Go());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;gi(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,zi)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-h*h),d=0+c*1.25,p=u*d,{_lodMax:_}=this,M=this._sizeLods[n],m=3*M*(n>_-Ln?n-_+Ln:0),f=4*(this._cubeSize-M);l.envMap.value=e.texture,l.roughness.value=p,l.mipInt.value=_-t,gi(r,m,f,3*M,2*M),s.setRenderTarget(r),s.render(o,zi),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=_-n,gi(e,m,f,3*M,2*M),s.setRenderTarget(e),s.render(o,zi)}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Ve("blur direction must be either latitudinal or longitudinal!");const h=3,u=this._lodMeshes[s];u.material=c;const d=c.uniforms,p=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Wn-1),M=r/_,m=isFinite(r)?1+Math.floor(h*M):Wn;m>Wn&&Ce(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Wn}`);const f=[];let y=0;for(let R=0;R<Wn;++R){const I=R/M,x=Math.exp(-I*I/2);f.push(x),R===0?y+=x:R<m&&(y+=2*x)}for(let R=0;R<f.length;R++)f[R]=f[R]/y;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:b}=this;d.dTheta.value=_,d.mipInt.value=b-n;const E=this._sizeLods[s],w=3*E*(s>b-Ln?s-b+Ln:0),A=4*(this._cubeSize-E);gi(t,w,A,3*E,2*E),l.setRenderTarget(t),l.render(u,zi)}}function bf(i){const e=[],t=[],n=[];let s=i;const r=i-Ln+1+Bo.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);e.push(o);let l=1/o;a>i-Ln?l=Bo[a-i+Ln-1]:a===0&&(l=0),t.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,_=6,M=3,m=2,f=1,y=new Float32Array(M*_*p),b=new Float32Array(m*_*p),E=new Float32Array(f*_*p);for(let A=0;A<p;A++){const R=A%3*2/3-1,I=A>2?0:-1,x=[R,I,0,R+2/3,I,0,R+2/3,I+1,0,R,I,0,R+2/3,I+1,0,R,I+1,0];y.set(x,M*_*A),b.set(d,m*_*A);const S=[A,A,A,A,A,A];E.set(S,f*_*A)}const w=new Pt;w.setAttribute("position",new Wt(y,M)),w.setAttribute("uv",new Wt(b,m)),w.setAttribute("faceIndex",new Wt(E,f)),n.push(new ot(w,null)),s>Ln&&s--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function Vo(i,e,t){const n=new rn(i,e,t);return n.texture.mapping=Bs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function gi(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function wf(i,e,t){return new ln({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Ef,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Hs(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 3.2: Transform view direction to hemisphere configuration
				vec3 Vh = normalize(vec3(alpha * V.x, alpha * V.y, V.z));

				// Section 4.1: Orthonormal basis
				float lensq = Vh.x * Vh.x + Vh.y * Vh.y;
				vec3 T1 = lensq > 0.0 ? vec3(-Vh.y, Vh.x, 0.0) / sqrt(lensq) : vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(Vh, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + Vh.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * Vh;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Af(i,e,t){const n=new Float32Array(Wn),s=new L(0,1,0);return new ln({name:"SphericalGaussianBlur",defines:{n:Wn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Go(){return new ln({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Ho(){return new ln({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Hs(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Rf(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===kr||l===Vr,h=l===Kn||l===Si;if(c||h){let u=e.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return t===null&&(t=new ko(i)),u=c?t.fromEquirectangular(o,u):t.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,e.set(o,u),u.texture;if(u!==void 0)return u.texture;{const p=o.image;return c&&p&&p.height>0||h&&p&&s(p)?(t===null&&(t=new ko(i)),u=c?t.fromEquirectangular(o):t.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,e.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function s(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function Cf(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Yi("WebGLRenderer: "+n+" extension not supported."),s}}}function Pf(i,e,t,n){const s={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&e.remove(d.index);for(const _ in d.attributes)e.remove(d.attributes[_]);d.removeEventListener("dispose",a),delete s[d.id];const p=r.get(d);p&&(e.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function l(u){const d=u.attributes;for(const p in d)e.update(d[p],i.ARRAY_BUFFER)}function c(u){const d=[],p=u.index,_=u.attributes.position;let M=0;if(p!==null){const y=p.array;M=p.version;for(let b=0,E=y.length;b<E;b+=3){const w=y[b+0],A=y[b+1],R=y[b+2];d.push(w,A,A,R,R,w)}}else if(_!==void 0){const y=_.array;M=_.version;for(let b=0,E=y.length/3-1;b<E;b+=3){const w=b+0,A=b+1,R=b+2;d.push(w,A,A,R,R,w)}}else return;const m=new(Rl(d)?Dl:Ll)(d,1);m.version=M;const f=r.get(u);f&&e.remove(f),r.set(u,m)}function h(u){const d=r.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Lf(i,e,t){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,p){i.drawElements(n,p,r,d*a),t.update(p,n,1)}function c(d,p,_){_!==0&&(i.drawElementsInstanced(n,p,r,d*a,_),t.update(p,n,_))}function h(d,p,_){if(_===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,d,0,_);let m=0;for(let f=0;f<_;f++)m+=p[f];t.update(m,n,1)}function u(d,p,_,M){if(_===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)c(d[f]/a,p[f],M[f]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,d,0,M,0,_);let f=0;for(let y=0;y<_;y++)f+=p[y]*M[y];t.update(f,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Df(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:Ve("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function If(i,e,t){const n=new WeakMap,s=new ht;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==u){let S=function(){I.dispose(),n.delete(o),o.removeEventListener("dispose",S)};var p=S;d!==void 0&&d.texture.dispose();const _=o.morphAttributes.position!==void 0,M=o.morphAttributes.normal!==void 0,m=o.morphAttributes.color!==void 0,f=o.morphAttributes.position||[],y=o.morphAttributes.normal||[],b=o.morphAttributes.color||[];let E=0;_===!0&&(E=1),M===!0&&(E=2),m===!0&&(E=3);let w=o.attributes.position.count*E,A=1;w>e.maxTextureSize&&(A=Math.ceil(w/e.maxTextureSize),w=e.maxTextureSize);const R=new Float32Array(w*A*4*u),I=new Cl(R,w,A,u);I.type=en,I.needsUpdate=!0;const x=E*4;for(let P=0;P<u;P++){const O=f[P],B=y[P],X=b[P],W=w*A*4*P;for(let G=0;G<O.count;G++){const V=G*x;_===!0&&(s.fromBufferAttribute(O,G),R[W+V+0]=s.x,R[W+V+1]=s.y,R[W+V+2]=s.z,R[W+V+3]=0),M===!0&&(s.fromBufferAttribute(B,G),R[W+V+4]=s.x,R[W+V+5]=s.y,R[W+V+6]=s.z,R[W+V+7]=0),m===!0&&(s.fromBufferAttribute(X,G),R[W+V+8]=s.x,R[W+V+9]=s.y,R[W+V+10]=s.z,R[W+V+11]=X.itemSize===4?s.w:1)}}d={count:u,texture:I,size:new Pe(w,A)},n.set(o,d),o.addEventListener("dispose",S)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let _=0;for(let m=0;m<c.length;m++)_+=c[m];const M=o.morphTargetsRelative?1:1-_;l.getUniforms().setValue(i,"morphTargetBaseInfluence",M),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Uf(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=e.get(l,h);if(s.get(u)!==c&&(e.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}const Nf={[fl]:"LINEAR_TONE_MAPPING",[pl]:"REINHARD_TONE_MAPPING",[ml]:"CINEON_TONE_MAPPING",[Pa]:"ACES_FILMIC_TONE_MAPPING",[_l]:"AGX_TONE_MAPPING",[xl]:"NEUTRAL_TONE_MAPPING",[gl]:"CUSTOM_TONE_MAPPING"};function Ff(i,e,t,n,s){const r=new rn(e,t,{type:i,depthBuffer:n,stencilBuffer:s}),a=new rn(e,t,{type:Mn,depthBuffer:!1,stencilBuffer:!1}),o=new Pt;o.setAttribute("position",new St([-1,3,0,-1,-1,0,3,-1,0],3)),o.setAttribute("uv",new St([0,2,0,0,2,0],2));const l=new yh({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),c=new ot(o,l),h=new $a(-1,1,1,-1,0,1);let u=null,d=null,p=!1,_,M=null,m=[],f=!1;this.setSize=function(y,b){r.setSize(y,b),a.setSize(y,b);for(let E=0;E<m.length;E++){const w=m[E];w.setSize&&w.setSize(y,b)}},this.setEffects=function(y){m=y,f=m.length>0&&m[0].isRenderPass===!0;const b=r.width,E=r.height;for(let w=0;w<m.length;w++){const A=m[w];A.setSize&&A.setSize(b,E)}},this.begin=function(y,b){if(p||y.toneMapping===sn&&m.length===0)return!1;if(M=b,b!==null){const E=b.width,w=b.height;(r.width!==E||r.height!==w)&&this.setSize(E,w)}return f===!1&&y.setRenderTarget(r),_=y.toneMapping,y.toneMapping=sn,!0},this.hasRenderPass=function(){return f},this.end=function(y,b){y.toneMapping=_,p=!0;let E=r,w=a;for(let A=0;A<m.length;A++){const R=m[A];if(R.enabled!==!1&&(R.render(y,w,E,b),R.needsSwap!==!1)){const I=E;E=w,w=I}}if(u!==y.outputColorSpace||d!==y.toneMapping){u=y.outputColorSpace,d=y.toneMapping,l.defines={},He.getTransfer(u)===je&&(l.defines.SRGB_TRANSFER="");const A=Nf[d];A&&(l.defines[A]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=E.texture,y.setRenderTarget(M),y.render(c,h),M=null,p=!1},this.isCompositing=function(){return p},this.dispose=function(){r.dispose(),a.dispose(),o.dispose(),l.dispose()}}const Xl=new Et,wa=new $i(1,1),ql=new Cl,Yl=new Kc,$l=new Nl,Wo=[],Xo=[],qo=new Float32Array(16),Yo=new Float32Array(9),$o=new Float32Array(4);function Pi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Wo[s];if(r===void 0&&(r=new Float32Array(s),Wo[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function gt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function _t(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ws(i,e){let t=Xo[e];t===void 0&&(t=new Int32Array(e),Xo[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Of(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Bf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2fv(this.addr,e),_t(t,e)}}function zf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(gt(t,e))return;i.uniform3fv(this.addr,e),_t(t,e)}}function kf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4fv(this.addr,e),_t(t,e)}}function Vf(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;$o.set(n),i.uniformMatrix2fv(this.addr,!1,$o),_t(t,n)}}function Gf(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;Yo.set(n),i.uniformMatrix3fv(this.addr,!1,Yo),_t(t,n)}}function Hf(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;qo.set(n),i.uniformMatrix4fv(this.addr,!1,qo),_t(t,n)}}function Wf(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Xf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2iv(this.addr,e),_t(t,e)}}function qf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3iv(this.addr,e),_t(t,e)}}function Yf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4iv(this.addr,e),_t(t,e)}}function $f(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Kf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2uiv(this.addr,e),_t(t,e)}}function jf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3uiv(this.addr,e),_t(t,e)}}function Zf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4uiv(this.addr,e),_t(t,e)}}function Jf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(wa.compareFunction=t.isReversedDepthBuffer()?Ba:Oa,r=wa):r=Xl,t.setTexture2D(e||r,s)}function Qf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Yl,s)}function ep(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||$l,s)}function tp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||ql,s)}function np(i){switch(i){case 5126:return Of;case 35664:return Bf;case 35665:return zf;case 35666:return kf;case 35674:return Vf;case 35675:return Gf;case 35676:return Hf;case 5124:case 35670:return Wf;case 35667:case 35671:return Xf;case 35668:case 35672:return qf;case 35669:case 35673:return Yf;case 5125:return $f;case 36294:return Kf;case 36295:return jf;case 36296:return Zf;case 35678:case 36198:case 36298:case 36306:case 35682:return Jf;case 35679:case 36299:case 36307:return Qf;case 35680:case 36300:case 36308:case 36293:return ep;case 36289:case 36303:case 36311:case 36292:return tp}}function ip(i,e){i.uniform1fv(this.addr,e)}function sp(i,e){const t=Pi(e,this.size,2);i.uniform2fv(this.addr,t)}function rp(i,e){const t=Pi(e,this.size,3);i.uniform3fv(this.addr,t)}function ap(i,e){const t=Pi(e,this.size,4);i.uniform4fv(this.addr,t)}function op(i,e){const t=Pi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function lp(i,e){const t=Pi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function cp(i,e){const t=Pi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function hp(i,e){i.uniform1iv(this.addr,e)}function up(i,e){i.uniform2iv(this.addr,e)}function dp(i,e){i.uniform3iv(this.addr,e)}function fp(i,e){i.uniform4iv(this.addr,e)}function pp(i,e){i.uniform1uiv(this.addr,e)}function mp(i,e){i.uniform2uiv(this.addr,e)}function gp(i,e){i.uniform3uiv(this.addr,e)}function _p(i,e){i.uniform4uiv(this.addr,e)}function xp(i,e,t){const n=this.cache,s=e.length,r=Ws(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=wa:a=Xl;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function vp(i,e,t){const n=this.cache,s=e.length,r=Ws(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Yl,r[a])}function Mp(i,e,t){const n=this.cache,s=e.length,r=Ws(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||$l,r[a])}function Sp(i,e,t){const n=this.cache,s=e.length,r=Ws(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||ql,r[a])}function yp(i){switch(i){case 5126:return ip;case 35664:return sp;case 35665:return rp;case 35666:return ap;case 35674:return op;case 35675:return lp;case 35676:return cp;case 5124:case 35670:return hp;case 35667:case 35671:return up;case 35668:case 35672:return dp;case 35669:case 35673:return fp;case 5125:return pp;case 36294:return mp;case 36295:return gp;case 36296:return _p;case 35678:case 36198:case 36298:case 36306:case 35682:return xp;case 35679:case 36299:case 36307:return vp;case 35680:case 36300:case 36308:case 36293:return Mp;case 36289:case 36303:case 36311:case 36292:return Sp}}class Ep{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=np(t.type)}}class Tp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=yp(t.type)}}class bp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const Rr=/(\w+)(\])?(\[|\.)?/g;function Ko(i,e){i.seq.push(e),i.map[e.id]=e}function wp(i,e,t){const n=i.name,s=n.length;for(Rr.lastIndex=0;;){const r=Rr.exec(n),a=Rr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Ko(t,c===void 0?new Ep(o,i,e):new Tp(o,i,e));break}else{let u=t.map[o];u===void 0&&(u=new bp(o),Ko(t,u)),t=u}}}class Ds{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);wp(o,l,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function jo(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Ap=37297;let Rp=0;function Cp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const Zo=new De;function Pp(i){He._getMatrix(Zo,He.workingColorSpace,i);const e=`mat3( ${Zo.elements.map(t=>t.toFixed(4))} )`;switch(He.getTransfer(i)){case Is:return[e,"LinearTransferOETF"];case je:return[e,"sRGBTransferOETF"];default:return Ce("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Jo(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Cp(i.getShaderSource(e),o)}else return r}function Lp(i,e){const t=Pp(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const Dp={[fl]:"Linear",[pl]:"Reinhard",[ml]:"Cineon",[Pa]:"ACESFilmic",[_l]:"AgX",[xl]:"Neutral",[gl]:"Custom"};function Ip(i,e){const t=Dp[e];return t===void 0?(Ce("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Ts=new L;function Up(){He.getLuminanceCoefficients(Ts);const i=Ts.x.toFixed(4),e=Ts.y.toFixed(4),t=Ts.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Np(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Gi).join(`
`)}function Fp(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Op(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function Gi(i){return i!==""}function Qo(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function el(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Bp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Aa(i){return i.replace(Bp,kp)}const zp=new Map;function kp(i,e){let t=Ie[e];if(t===void 0){const n=zp.get(e);if(n!==void 0)t=Ie[n],Ce('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Aa(t)}const Vp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function tl(i){return i.replace(Vp,Gp)}function Gp(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function nl(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const Hp={[As]:"SHADOWMAP_TYPE_PCF",[Vi]:"SHADOWMAP_TYPE_VSM"};function Wp(i){return Hp[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const Xp={[Kn]:"ENVMAP_TYPE_CUBE",[Si]:"ENVMAP_TYPE_CUBE",[Bs]:"ENVMAP_TYPE_CUBE_UV"};function qp(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Xp[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const Yp={[Si]:"ENVMAP_MODE_REFRACTION"};function $p(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Yp[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Kp={[dl]:"ENVMAP_BLENDING_MULTIPLY",[Pc]:"ENVMAP_BLENDING_MIX",[Lc]:"ENVMAP_BLENDING_ADD"};function jp(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Kp[i.combine]||"ENVMAP_BLENDING_NONE"}function Zp(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function Jp(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=Wp(t),c=qp(t),h=$p(t),u=jp(t),d=Zp(t),p=Np(t),_=Fp(r),M=s.createProgram();let m,f,y=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Gi).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Gi).join(`
`),f.length>0&&(f+=`
`)):(m=[nl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Gi).join(`
`),f=[nl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==sn?"#define TONE_MAPPING":"",t.toneMapping!==sn?Ie.tonemapping_pars_fragment:"",t.toneMapping!==sn?Ip("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ie.colorspace_pars_fragment,Lp("linearToOutputTexel",t.outputColorSpace),Up(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Gi).join(`
`)),a=Aa(a),a=Qo(a,t),a=el(a,t),o=Aa(o),o=Qo(o,t),o=el(o,t),a=tl(a),o=tl(o),t.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",t.glslVersion===co?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===co?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const b=y+m+a,E=y+f+o,w=jo(s,s.VERTEX_SHADER,b),A=jo(s,s.FRAGMENT_SHADER,E);s.attachShader(M,w),s.attachShader(M,A),t.index0AttributeName!==void 0?s.bindAttribLocation(M,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(M,0,"position"),s.linkProgram(M);function R(P){if(i.debug.checkShaderErrors){const O=s.getProgramInfoLog(M)||"",B=s.getShaderInfoLog(w)||"",X=s.getShaderInfoLog(A)||"",W=O.trim(),G=B.trim(),V=X.trim();let j=!0,he=!0;if(s.getProgramParameter(M,s.LINK_STATUS)===!1)if(j=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,M,w,A);else{const ae=Jo(s,w,"vertex"),ue=Jo(s,A,"fragment");Ve("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(M,s.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+W+`
`+ae+`
`+ue)}else W!==""?Ce("WebGLProgram: Program Info Log:",W):(G===""||V==="")&&(he=!1);he&&(P.diagnostics={runnable:j,programLog:W,vertexShader:{log:G,prefix:m},fragmentShader:{log:V,prefix:f}})}s.deleteShader(w),s.deleteShader(A),I=new Ds(s,M),x=Op(s,M)}let I;this.getUniforms=function(){return I===void 0&&R(this),I};let x;this.getAttributes=function(){return x===void 0&&R(this),x};let S=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return S===!1&&(S=s.getProgramParameter(M,Ap)),S},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(M),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Rp++,this.cacheKey=e,this.usedTimes=1,this.program=M,this.vertexShader=w,this.fragmentShader=A,this}let Qp=0;class em{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new tm(e),t.set(e,n)),n}}class tm{constructor(e){this.id=Qp++,this.code=e,this.usedTimes=0}}function nm(i,e,t,n,s,r,a){const o=new Va,l=new em,c=new Set,h=[],u=new Map,d=s.logarithmicDepthBuffer;let p=s.precision;const _={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function M(x){return c.add(x),x===0?"uv":`uv${x}`}function m(x,S,P,O,B){const X=O.fog,W=B.geometry,G=x.isMeshStandardMaterial?O.environment:null,V=(x.isMeshStandardMaterial?t:e).get(x.envMap||G),j=V&&V.mapping===Bs?V.image.height:null,he=_[x.type];x.precision!==null&&(p=s.getMaxPrecision(x.precision),p!==x.precision&&Ce("WebGLProgram.getParameters:",x.precision,"not supported, using",p,"instead."));const ae=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,ue=ae!==void 0?ae.length:0;let Oe=0;W.morphAttributes.position!==void 0&&(Oe=1),W.morphAttributes.normal!==void 0&&(Oe=2),W.morphAttributes.color!==void 0&&(Oe=3);let Ue,at,st,Y;if(he){const $e=Jt[he];Ue=$e.vertexShader,at=$e.fragmentShader}else Ue=x.vertexShader,at=x.fragmentShader,l.update(x),st=l.getVertexShaderID(x),Y=l.getFragmentShaderID(x);const Z=i.getRenderTarget(),pe=i.state.buffers.depth.getReversed(),Le=B.isInstancedMesh===!0,_e=B.isBatchedMesh===!0,We=!!x.map,xt=!!x.matcap,Ge=!!V,Ye=!!x.aoMap,Qe=!!x.lightMap,Ne=!!x.bumpMap,dt=!!x.normalMap,C=!!x.displacementMap,ft=!!x.emissiveMap,qe=!!x.metalnessMap,tt=!!x.roughnessMap,ve=x.anisotropy>0,T=x.clearcoat>0,g=x.dispersion>0,U=x.iridescence>0,q=x.sheen>0,K=x.transmission>0,H=ve&&!!x.anisotropyMap,Se=T&&!!x.clearcoatMap,ne=T&&!!x.clearcoatNormalMap,xe=T&&!!x.clearcoatRoughnessMap,Ae=U&&!!x.iridescenceMap,Q=U&&!!x.iridescenceThicknessMap,se=q&&!!x.sheenColorMap,ge=q&&!!x.sheenRoughnessMap,Me=!!x.specularMap,ie=!!x.specularColorMap,Fe=!!x.specularIntensityMap,D=K&&!!x.transmissionMap,ce=K&&!!x.thicknessMap,ee=!!x.gradientMap,de=!!x.alphaMap,J=x.alphaTest>0,$=!!x.alphaHash,te=!!x.extensions;let Re=sn;x.toneMapped&&(Z===null||Z.isXRRenderTarget===!0)&&(Re=i.toneMapping);const nt={shaderID:he,shaderType:x.type,shaderName:x.name,vertexShader:Ue,fragmentShader:at,defines:x.defines,customVertexShaderID:st,customFragmentShaderID:Y,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:p,batching:_e,batchingColor:_e&&B._colorsTexture!==null,instancing:Le,instancingColor:Le&&B.instanceColor!==null,instancingMorph:Le&&B.morphTexture!==null,outputColorSpace:Z===null?i.outputColorSpace:Z.isXRRenderTarget===!0?Z.texture.colorSpace:Ei,alphaToCoverage:!!x.alphaToCoverage,map:We,matcap:xt,envMap:Ge,envMapMode:Ge&&V.mapping,envMapCubeUVHeight:j,aoMap:Ye,lightMap:Qe,bumpMap:Ne,normalMap:dt,displacementMap:C,emissiveMap:ft,normalMapObjectSpace:dt&&x.normalMapType===Uc,normalMapTangentSpace:dt&&x.normalMapType===Al,metalnessMap:qe,roughnessMap:tt,anisotropy:ve,anisotropyMap:H,clearcoat:T,clearcoatMap:Se,clearcoatNormalMap:ne,clearcoatRoughnessMap:xe,dispersion:g,iridescence:U,iridescenceMap:Ae,iridescenceThicknessMap:Q,sheen:q,sheenColorMap:se,sheenRoughnessMap:ge,specularMap:Me,specularColorMap:ie,specularIntensityMap:Fe,transmission:K,transmissionMap:D,thicknessMap:ce,gradientMap:ee,opaque:x.transparent===!1&&x.blending===Yn&&x.alphaToCoverage===!1,alphaMap:de,alphaTest:J,alphaHash:$,combine:x.combine,mapUv:We&&M(x.map.channel),aoMapUv:Ye&&M(x.aoMap.channel),lightMapUv:Qe&&M(x.lightMap.channel),bumpMapUv:Ne&&M(x.bumpMap.channel),normalMapUv:dt&&M(x.normalMap.channel),displacementMapUv:C&&M(x.displacementMap.channel),emissiveMapUv:ft&&M(x.emissiveMap.channel),metalnessMapUv:qe&&M(x.metalnessMap.channel),roughnessMapUv:tt&&M(x.roughnessMap.channel),anisotropyMapUv:H&&M(x.anisotropyMap.channel),clearcoatMapUv:Se&&M(x.clearcoatMap.channel),clearcoatNormalMapUv:ne&&M(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:xe&&M(x.clearcoatRoughnessMap.channel),iridescenceMapUv:Ae&&M(x.iridescenceMap.channel),iridescenceThicknessMapUv:Q&&M(x.iridescenceThicknessMap.channel),sheenColorMapUv:se&&M(x.sheenColorMap.channel),sheenRoughnessMapUv:ge&&M(x.sheenRoughnessMap.channel),specularMapUv:Me&&M(x.specularMap.channel),specularColorMapUv:ie&&M(x.specularColorMap.channel),specularIntensityMapUv:Fe&&M(x.specularIntensityMap.channel),transmissionMapUv:D&&M(x.transmissionMap.channel),thicknessMapUv:ce&&M(x.thicknessMap.channel),alphaMapUv:de&&M(x.alphaMap.channel),vertexTangents:!!W.attributes.tangent&&(dt||ve),vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!W.attributes.uv&&(We||de),fog:!!X,useFog:x.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:x.flatShading===!0&&x.wireframe===!1,sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:pe,skinning:B.isSkinnedMesh===!0,morphTargets:W.morphAttributes.position!==void 0,morphNormals:W.morphAttributes.normal!==void 0,morphColors:W.morphAttributes.color!==void 0,morphTargetsCount:ue,morphTextureStride:Oe,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:Re,decodeVideoTexture:We&&x.map.isVideoTexture===!0&&He.getTransfer(x.map.colorSpace)===je,decodeVideoTextureEmissive:ft&&x.emissiveMap.isVideoTexture===!0&&He.getTransfer(x.emissiveMap.colorSpace)===je,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===mn,flipSided:x.side===It,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:te&&x.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(te&&x.extensions.multiDraw===!0||_e)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return nt.vertexUv1s=c.has(1),nt.vertexUv2s=c.has(2),nt.vertexUv3s=c.has(3),c.clear(),nt}function f(x){const S=[];if(x.shaderID?S.push(x.shaderID):(S.push(x.customVertexShaderID),S.push(x.customFragmentShaderID)),x.defines!==void 0)for(const P in x.defines)S.push(P),S.push(x.defines[P]);return x.isRawShaderMaterial===!1&&(y(S,x),b(S,x),S.push(i.outputColorSpace)),S.push(x.customProgramCacheKey),S.join()}function y(x,S){x.push(S.precision),x.push(S.outputColorSpace),x.push(S.envMapMode),x.push(S.envMapCubeUVHeight),x.push(S.mapUv),x.push(S.alphaMapUv),x.push(S.lightMapUv),x.push(S.aoMapUv),x.push(S.bumpMapUv),x.push(S.normalMapUv),x.push(S.displacementMapUv),x.push(S.emissiveMapUv),x.push(S.metalnessMapUv),x.push(S.roughnessMapUv),x.push(S.anisotropyMapUv),x.push(S.clearcoatMapUv),x.push(S.clearcoatNormalMapUv),x.push(S.clearcoatRoughnessMapUv),x.push(S.iridescenceMapUv),x.push(S.iridescenceThicknessMapUv),x.push(S.sheenColorMapUv),x.push(S.sheenRoughnessMapUv),x.push(S.specularMapUv),x.push(S.specularColorMapUv),x.push(S.specularIntensityMapUv),x.push(S.transmissionMapUv),x.push(S.thicknessMapUv),x.push(S.combine),x.push(S.fogExp2),x.push(S.sizeAttenuation),x.push(S.morphTargetsCount),x.push(S.morphAttributeCount),x.push(S.numDirLights),x.push(S.numPointLights),x.push(S.numSpotLights),x.push(S.numSpotLightMaps),x.push(S.numHemiLights),x.push(S.numRectAreaLights),x.push(S.numDirLightShadows),x.push(S.numPointLightShadows),x.push(S.numSpotLightShadows),x.push(S.numSpotLightShadowsWithMaps),x.push(S.numLightProbes),x.push(S.shadowMapType),x.push(S.toneMapping),x.push(S.numClippingPlanes),x.push(S.numClipIntersection),x.push(S.depthPacking)}function b(x,S){o.disableAll(),S.instancing&&o.enable(0),S.instancingColor&&o.enable(1),S.instancingMorph&&o.enable(2),S.matcap&&o.enable(3),S.envMap&&o.enable(4),S.normalMapObjectSpace&&o.enable(5),S.normalMapTangentSpace&&o.enable(6),S.clearcoat&&o.enable(7),S.iridescence&&o.enable(8),S.alphaTest&&o.enable(9),S.vertexColors&&o.enable(10),S.vertexAlphas&&o.enable(11),S.vertexUv1s&&o.enable(12),S.vertexUv2s&&o.enable(13),S.vertexUv3s&&o.enable(14),S.vertexTangents&&o.enable(15),S.anisotropy&&o.enable(16),S.alphaHash&&o.enable(17),S.batching&&o.enable(18),S.dispersion&&o.enable(19),S.batchingColor&&o.enable(20),S.gradientMap&&o.enable(21),x.push(o.mask),o.disableAll(),S.fog&&o.enable(0),S.useFog&&o.enable(1),S.flatShading&&o.enable(2),S.logarithmicDepthBuffer&&o.enable(3),S.reversedDepthBuffer&&o.enable(4),S.skinning&&o.enable(5),S.morphTargets&&o.enable(6),S.morphNormals&&o.enable(7),S.morphColors&&o.enable(8),S.premultipliedAlpha&&o.enable(9),S.shadowMapEnabled&&o.enable(10),S.doubleSided&&o.enable(11),S.flipSided&&o.enable(12),S.useDepthPacking&&o.enable(13),S.dithering&&o.enable(14),S.transmission&&o.enable(15),S.sheen&&o.enable(16),S.opaque&&o.enable(17),S.pointsUvs&&o.enable(18),S.decodeVideoTexture&&o.enable(19),S.decodeVideoTextureEmissive&&o.enable(20),S.alphaToCoverage&&o.enable(21),x.push(o.mask)}function E(x){const S=_[x.type];let P;if(S){const O=Jt[S];P=lh.clone(O.uniforms)}else P=x.uniforms;return P}function w(x,S){let P=u.get(S);return P!==void 0?++P.usedTimes:(P=new Jp(i,S,x,r),h.push(P),u.set(S,P)),P}function A(x){if(--x.usedTimes===0){const S=h.indexOf(x);h[S]=h[h.length-1],h.pop(),u.delete(x.cacheKey),x.destroy()}}function R(x){l.remove(x)}function I(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:E,acquireProgram:w,releaseProgram:A,releaseShaderCache:R,programs:h,dispose:I}}function im(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function sm(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function il(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function sl(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(u,d,p,_,M,m){let f=i[e];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:_,renderOrder:u.renderOrder,z:M,group:m},i[e]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=_,f.renderOrder=u.renderOrder,f.z=M,f.group=m),e++,f}function o(u,d,p,_,M,m){const f=a(u,d,p,_,M,m);p.transmission>0?n.push(f):p.transparent===!0?s.push(f):t.push(f)}function l(u,d,p,_,M,m){const f=a(u,d,p,_,M,m);p.transmission>0?n.unshift(f):p.transparent===!0?s.unshift(f):t.unshift(f)}function c(u,d){t.length>1&&t.sort(u||sm),n.length>1&&n.sort(d||il),s.length>1&&s.sort(d||il)}function h(){for(let u=e,d=i.length;u<d;u++){const p=i[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:h,sort:c}}function rm(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new sl,i.set(n,[a])):s>=r.length?(a=new sl,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function am(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new L,color:new ze};break;case"SpotLight":t={position:new L,direction:new L,color:new ze,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new L,color:new ze,distance:0,decay:0};break;case"HemisphereLight":t={direction:new L,skyColor:new ze,groundColor:new ze};break;case"RectAreaLight":t={color:new ze,position:new L,halfWidth:new L,halfHeight:new L};break}return i[e.id]=t,t}}}function om(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let lm=0;function cm(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function hm(i){const e=new am,t=om(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new L);const s=new L,r=new rt,a=new rt;function o(c){let h=0,u=0,d=0;for(let x=0;x<9;x++)n.probe[x].set(0,0,0);let p=0,_=0,M=0,m=0,f=0,y=0,b=0,E=0,w=0,A=0,R=0;c.sort(cm);for(let x=0,S=c.length;x<S;x++){const P=c[x],O=P.color,B=P.intensity,X=P.distance;let W=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===yi?W=P.shadow.map.texture:W=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=O.r*B,u+=O.g*B,d+=O.b*B;else if(P.isLightProbe){for(let G=0;G<9;G++)n.probe[G].addScaledVector(P.sh.coefficients[G],B);R++}else if(P.isDirectionalLight){const G=e.get(P);if(G.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){const V=P.shadow,j=t.get(P);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,n.directionalShadow[p]=j,n.directionalShadowMap[p]=W,n.directionalShadowMatrix[p]=P.shadow.matrix,y++}n.directional[p]=G,p++}else if(P.isSpotLight){const G=e.get(P);G.position.setFromMatrixPosition(P.matrixWorld),G.color.copy(O).multiplyScalar(B),G.distance=X,G.coneCos=Math.cos(P.angle),G.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),G.decay=P.decay,n.spot[M]=G;const V=P.shadow;if(P.map&&(n.spotLightMap[w]=P.map,w++,V.updateMatrices(P),P.castShadow&&A++),n.spotLightMatrix[M]=V.matrix,P.castShadow){const j=t.get(P);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,n.spotShadow[M]=j,n.spotShadowMap[M]=W,E++}M++}else if(P.isRectAreaLight){const G=e.get(P);G.color.copy(O).multiplyScalar(B),G.halfWidth.set(P.width*.5,0,0),G.halfHeight.set(0,P.height*.5,0),n.rectArea[m]=G,m++}else if(P.isPointLight){const G=e.get(P);if(G.color.copy(P.color).multiplyScalar(P.intensity),G.distance=P.distance,G.decay=P.decay,P.castShadow){const V=P.shadow,j=t.get(P);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,j.shadowCameraNear=V.camera.near,j.shadowCameraFar=V.camera.far,n.pointShadow[_]=j,n.pointShadowMap[_]=W,n.pointShadowMatrix[_]=P.shadow.matrix,b++}n.point[_]=G,_++}else if(P.isHemisphereLight){const G=e.get(P);G.skyColor.copy(P.color).multiplyScalar(B),G.groundColor.copy(P.groundColor).multiplyScalar(B),n.hemi[f]=G,f++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=oe.LTC_FLOAT_1,n.rectAreaLTC2=oe.LTC_FLOAT_2):(n.rectAreaLTC1=oe.LTC_HALF_1,n.rectAreaLTC2=oe.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const I=n.hash;(I.directionalLength!==p||I.pointLength!==_||I.spotLength!==M||I.rectAreaLength!==m||I.hemiLength!==f||I.numDirectionalShadows!==y||I.numPointShadows!==b||I.numSpotShadows!==E||I.numSpotMaps!==w||I.numLightProbes!==R)&&(n.directional.length=p,n.spot.length=M,n.rectArea.length=m,n.point.length=_,n.hemi.length=f,n.directionalShadow.length=y,n.directionalShadowMap.length=y,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=E,n.spotShadowMap.length=E,n.directionalShadowMatrix.length=y,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=E+w-A,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=R,I.directionalLength=p,I.pointLength=_,I.spotLength=M,I.rectAreaLength=m,I.hemiLength=f,I.numDirectionalShadows=y,I.numPointShadows=b,I.numSpotShadows=E,I.numSpotMaps=w,I.numLightProbes=R,n.version=lm++)}function l(c,h){let u=0,d=0,p=0,_=0,M=0;const m=h.matrixWorldInverse;for(let f=0,y=c.length;f<y;f++){const b=c[f];if(b.isDirectionalLight){const E=n.directional[u];E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(m),u++}else if(b.isSpotLight){const E=n.spot[p];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(m),p++}else if(b.isRectAreaLight){const E=n.rectArea[_];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),a.identity(),r.copy(b.matrixWorld),r.premultiply(m),a.extractRotation(r),E.halfWidth.set(b.width*.5,0,0),E.halfHeight.set(0,b.height*.5,0),E.halfWidth.applyMatrix4(a),E.halfHeight.applyMatrix4(a),_++}else if(b.isPointLight){const E=n.point[d];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),d++}else if(b.isHemisphereLight){const E=n.hemi[M];E.direction.setFromMatrixPosition(b.matrixWorld),E.direction.transformDirection(m),M++}}}return{setup:o,setupView:l,state:n}}function rl(i){const e=new hm(i),t=[],n=[];function s(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function a(h){n.push(h)}function o(){e.setup(t)}function l(h){e.setupView(t,h)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function um(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new rl(i),e.set(s,[o])):r>=a.length?(o=new rl(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const dm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,fm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,pm=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],mm=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],al=new rt,ki=new L,Cr=new L;function gm(i,e,t){let n=new Ha;const s=new Pe,r=new Pe,a=new ht,o=new Eh,l=new Th,c={},h=t.maxTextureSize,u={[Un]:It,[It]:Un,[mn]:mn},d=new ln({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Pe},radius:{value:4}},vertexShader:dm,fragmentShader:fm}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const _=new Pt;_.setAttribute("position",new Wt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const M=new ot(_,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=As;let f=this.type;this.render=function(A,R,I){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;A.type===uc&&(Ce("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),A.type=As);const x=i.getRenderTarget(),S=i.getActiveCubeFace(),P=i.getActiveMipmapLevel(),O=i.state;O.setBlending(xn),O.buffers.depth.getReversed()===!0?O.buffers.color.setClear(0,0,0,0):O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);const B=f!==this.type;B&&R.traverse(function(X){X.material&&(Array.isArray(X.material)?X.material.forEach(W=>W.needsUpdate=!0):X.material.needsUpdate=!0)});for(let X=0,W=A.length;X<W;X++){const G=A[X],V=G.shadow;if(V===void 0){Ce("WebGLShadowMap:",G,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;s.copy(V.mapSize);const j=V.getFrameExtents();if(s.multiply(j),r.copy(V.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/j.x),s.x=r.x*j.x,V.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/j.y),s.y=r.y*j.y,V.mapSize.y=r.y)),V.map===null||B===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===Vi){if(G.isPointLight){Ce("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new rn(s.x,s.y,{format:yi,type:Mn,minFilter:wt,magFilter:wt,generateMipmaps:!1}),V.map.texture.name=G.name+".shadowMap",V.map.depthTexture=new $i(s.x,s.y,en),V.map.depthTexture.name=G.name+".shadowMapDepth",V.map.depthTexture.format=Sn,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=yt,V.map.depthTexture.magFilter=yt}else{G.isPointLight?(V.map=new Fl(s.x),V.map.depthTexture=new Sh(s.x,an)):(V.map=new rn(s.x,s.y),V.map.depthTexture=new $i(s.x,s.y,an)),V.map.depthTexture.name=G.name+".shadowMap",V.map.depthTexture.format=Sn;const ae=i.state.buffers.depth.getReversed();this.type===As?(V.map.depthTexture.compareFunction=ae?Ba:Oa,V.map.depthTexture.minFilter=wt,V.map.depthTexture.magFilter=wt):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=yt,V.map.depthTexture.magFilter=yt)}V.camera.updateProjectionMatrix()}const he=V.map.isWebGLCubeRenderTarget?6:1;for(let ae=0;ae<he;ae++){if(V.map.isWebGLCubeRenderTarget)i.setRenderTarget(V.map,ae),i.clear();else{ae===0&&(i.setRenderTarget(V.map),i.clear());const ue=V.getViewport(ae);a.set(r.x*ue.x,r.y*ue.y,r.x*ue.z,r.y*ue.w),O.viewport(a)}if(G.isPointLight){const ue=V.camera,Oe=V.matrix,Ue=G.distance||ue.far;Ue!==ue.far&&(ue.far=Ue,ue.updateProjectionMatrix()),ki.setFromMatrixPosition(G.matrixWorld),ue.position.copy(ki),Cr.copy(ue.position),Cr.add(pm[ae]),ue.up.copy(mm[ae]),ue.lookAt(Cr),ue.updateMatrixWorld(),Oe.makeTranslation(-ki.x,-ki.y,-ki.z),al.multiplyMatrices(ue.projectionMatrix,ue.matrixWorldInverse),V._frustum.setFromProjectionMatrix(al,ue.coordinateSystem,ue.reversedDepth)}else V.updateMatrices(G);n=V.getFrustum(),E(R,I,V.camera,G,this.type)}V.isPointLightShadow!==!0&&this.type===Vi&&y(V,I),V.needsUpdate=!1}f=this.type,m.needsUpdate=!1,i.setRenderTarget(x,S,P)};function y(A,R){const I=e.update(M);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new rn(s.x,s.y,{format:yi,type:Mn})),d.uniforms.shadow_pass.value=A.map.depthTexture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(R,null,I,d,M,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(R,null,I,p,M,null)}function b(A,R,I,x){let S=null;const P=I.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(P!==void 0)S=P;else if(S=I.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const O=S.uuid,B=R.uuid;let X=c[O];X===void 0&&(X={},c[O]=X);let W=X[B];W===void 0&&(W=S.clone(),X[B]=W,R.addEventListener("dispose",w)),S=W}if(S.visible=R.visible,S.wireframe=R.wireframe,x===Vi?S.side=R.shadowSide!==null?R.shadowSide:R.side:S.side=R.shadowSide!==null?R.shadowSide:u[R.side],S.alphaMap=R.alphaMap,S.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,S.map=R.map,S.clipShadows=R.clipShadows,S.clippingPlanes=R.clippingPlanes,S.clipIntersection=R.clipIntersection,S.displacementMap=R.displacementMap,S.displacementScale=R.displacementScale,S.displacementBias=R.displacementBias,S.wireframeLinewidth=R.wireframeLinewidth,S.linewidth=R.linewidth,I.isPointLight===!0&&S.isMeshDistanceMaterial===!0){const O=i.properties.get(S);O.light=I}return S}function E(A,R,I,x,S){if(A.visible===!1)return;if(A.layers.test(R.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&S===Vi)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(I.matrixWorldInverse,A.matrixWorld);const B=e.update(A),X=A.material;if(Array.isArray(X)){const W=B.groups;for(let G=0,V=W.length;G<V;G++){const j=W[G],he=X[j.materialIndex];if(he&&he.visible){const ae=b(A,he,x,S);A.onBeforeShadow(i,A,R,I,B,ae,j),i.renderBufferDirect(I,null,B,ae,A,j),A.onAfterShadow(i,A,R,I,B,ae,j)}}}else if(X.visible){const W=b(A,X,x,S);A.onBeforeShadow(i,A,R,I,B,W,null),i.renderBufferDirect(I,null,B,W,A,null),A.onAfterShadow(i,A,R,I,B,W,null)}}const O=A.children;for(let B=0,X=O.length;B<X;B++)E(O[B],R,I,x,S)}function w(A){A.target.removeEventListener("dispose",w);for(const I in c){const x=c[I],S=A.target.uuid;S in x&&(x[S].dispose(),delete x[S])}}}const _m={[Ir]:Ur,[Nr]:Br,[Fr]:zr,[Mi]:Or,[Ur]:Ir,[Br]:Nr,[zr]:Fr,[Or]:Mi};function xm(i,e){function t(){let D=!1;const ce=new ht;let ee=null;const de=new ht(0,0,0,0);return{setMask:function(J){ee!==J&&!D&&(i.colorMask(J,J,J,J),ee=J)},setLocked:function(J){D=J},setClear:function(J,$,te,Re,nt){nt===!0&&(J*=Re,$*=Re,te*=Re),ce.set(J,$,te,Re),de.equals(ce)===!1&&(i.clearColor(J,$,te,Re),de.copy(ce))},reset:function(){D=!1,ee=null,de.set(-1,0,0,0)}}}function n(){let D=!1,ce=!1,ee=null,de=null,J=null;return{setReversed:function($){if(ce!==$){const te=e.get("EXT_clip_control");$?te.clipControlEXT(te.LOWER_LEFT_EXT,te.ZERO_TO_ONE_EXT):te.clipControlEXT(te.LOWER_LEFT_EXT,te.NEGATIVE_ONE_TO_ONE_EXT),ce=$;const Re=J;J=null,this.setClear(Re)}},getReversed:function(){return ce},setTest:function($){$?Z(i.DEPTH_TEST):pe(i.DEPTH_TEST)},setMask:function($){ee!==$&&!D&&(i.depthMask($),ee=$)},setFunc:function($){if(ce&&($=_m[$]),de!==$){switch($){case Ir:i.depthFunc(i.NEVER);break;case Ur:i.depthFunc(i.ALWAYS);break;case Nr:i.depthFunc(i.LESS);break;case Mi:i.depthFunc(i.LEQUAL);break;case Fr:i.depthFunc(i.EQUAL);break;case Or:i.depthFunc(i.GEQUAL);break;case Br:i.depthFunc(i.GREATER);break;case zr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}de=$}},setLocked:function($){D=$},setClear:function($){J!==$&&(ce&&($=1-$),i.clearDepth($),J=$)},reset:function(){D=!1,ee=null,de=null,J=null,ce=!1}}}function s(){let D=!1,ce=null,ee=null,de=null,J=null,$=null,te=null,Re=null,nt=null;return{setTest:function($e){D||($e?Z(i.STENCIL_TEST):pe(i.STENCIL_TEST))},setMask:function($e){ce!==$e&&!D&&(i.stencilMask($e),ce=$e)},setFunc:function($e,Kt,cn){(ee!==$e||de!==Kt||J!==cn)&&(i.stencilFunc($e,Kt,cn),ee=$e,de=Kt,J=cn)},setOp:function($e,Kt,cn){($!==$e||te!==Kt||Re!==cn)&&(i.stencilOp($e,Kt,cn),$=$e,te=Kt,Re=cn)},setLocked:function($e){D=$e},setClear:function($e){nt!==$e&&(i.clearStencil($e),nt=$e)},reset:function(){D=!1,ce=null,ee=null,de=null,J=null,$=null,te=null,Re=null,nt=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,p=[],_=null,M=!1,m=null,f=null,y=null,b=null,E=null,w=null,A=null,R=new ze(0,0,0),I=0,x=!1,S=null,P=null,O=null,B=null,X=null;const W=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,V=0;const j=i.getParameter(i.VERSION);j.indexOf("WebGL")!==-1?(V=parseFloat(/^WebGL (\d)/.exec(j)[1]),G=V>=1):j.indexOf("OpenGL ES")!==-1&&(V=parseFloat(/^OpenGL ES (\d)/.exec(j)[1]),G=V>=2);let he=null,ae={};const ue=i.getParameter(i.SCISSOR_BOX),Oe=i.getParameter(i.VIEWPORT),Ue=new ht().fromArray(ue),at=new ht().fromArray(Oe);function st(D,ce,ee,de){const J=new Uint8Array(4),$=i.createTexture();i.bindTexture(D,$),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let te=0;te<ee;te++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(ce,0,i.RGBA,1,1,de,0,i.RGBA,i.UNSIGNED_BYTE,J):i.texImage2D(ce+te,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,J);return $}const Y={};Y[i.TEXTURE_2D]=st(i.TEXTURE_2D,i.TEXTURE_2D,1),Y[i.TEXTURE_CUBE_MAP]=st(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[i.TEXTURE_2D_ARRAY]=st(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Y[i.TEXTURE_3D]=st(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),Z(i.DEPTH_TEST),a.setFunc(Mi),Ne(!1),dt(ro),Z(i.CULL_FACE),Ye(xn);function Z(D){h[D]!==!0&&(i.enable(D),h[D]=!0)}function pe(D){h[D]!==!1&&(i.disable(D),h[D]=!1)}function Le(D,ce){return u[D]!==ce?(i.bindFramebuffer(D,ce),u[D]=ce,D===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ce),D===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ce),!0):!1}function _e(D,ce){let ee=p,de=!1;if(D){ee=d.get(ce),ee===void 0&&(ee=[],d.set(ce,ee));const J=D.textures;if(ee.length!==J.length||ee[0]!==i.COLOR_ATTACHMENT0){for(let $=0,te=J.length;$<te;$++)ee[$]=i.COLOR_ATTACHMENT0+$;ee.length=J.length,de=!0}}else ee[0]!==i.BACK&&(ee[0]=i.BACK,de=!0);de&&i.drawBuffers(ee)}function We(D){return _!==D?(i.useProgram(D),_=D,!0):!1}const xt={[Hn]:i.FUNC_ADD,[fc]:i.FUNC_SUBTRACT,[pc]:i.FUNC_REVERSE_SUBTRACT};xt[mc]=i.MIN,xt[gc]=i.MAX;const Ge={[_c]:i.ZERO,[xc]:i.ONE,[vc]:i.SRC_COLOR,[Lr]:i.SRC_ALPHA,[bc]:i.SRC_ALPHA_SATURATE,[Ec]:i.DST_COLOR,[Sc]:i.DST_ALPHA,[Mc]:i.ONE_MINUS_SRC_COLOR,[Dr]:i.ONE_MINUS_SRC_ALPHA,[Tc]:i.ONE_MINUS_DST_COLOR,[yc]:i.ONE_MINUS_DST_ALPHA,[wc]:i.CONSTANT_COLOR,[Ac]:i.ONE_MINUS_CONSTANT_COLOR,[Rc]:i.CONSTANT_ALPHA,[Cc]:i.ONE_MINUS_CONSTANT_ALPHA};function Ye(D,ce,ee,de,J,$,te,Re,nt,$e){if(D===xn){M===!0&&(pe(i.BLEND),M=!1);return}if(M===!1&&(Z(i.BLEND),M=!0),D!==dc){if(D!==m||$e!==x){if((f!==Hn||E!==Hn)&&(i.blendEquation(i.FUNC_ADD),f=Hn,E=Hn),$e)switch(D){case Yn:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Hi:i.blendFunc(i.ONE,i.ONE);break;case ao:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case oo:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ve("WebGLState: Invalid blending: ",D);break}else switch(D){case Yn:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Hi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case ao:Ve("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case oo:Ve("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ve("WebGLState: Invalid blending: ",D);break}y=null,b=null,w=null,A=null,R.set(0,0,0),I=0,m=D,x=$e}return}J=J||ce,$=$||ee,te=te||de,(ce!==f||J!==E)&&(i.blendEquationSeparate(xt[ce],xt[J]),f=ce,E=J),(ee!==y||de!==b||$!==w||te!==A)&&(i.blendFuncSeparate(Ge[ee],Ge[de],Ge[$],Ge[te]),y=ee,b=de,w=$,A=te),(Re.equals(R)===!1||nt!==I)&&(i.blendColor(Re.r,Re.g,Re.b,nt),R.copy(Re),I=nt),m=D,x=!1}function Qe(D,ce){D.side===mn?pe(i.CULL_FACE):Z(i.CULL_FACE);let ee=D.side===It;ce&&(ee=!ee),Ne(ee),D.blending===Yn&&D.transparent===!1?Ye(xn):Ye(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),r.setMask(D.colorWrite);const de=D.stencilWrite;o.setTest(de),de&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),ft(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?Z(i.SAMPLE_ALPHA_TO_COVERAGE):pe(i.SAMPLE_ALPHA_TO_COVERAGE)}function Ne(D){S!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),S=D)}function dt(D){D!==cc?(Z(i.CULL_FACE),D!==P&&(D===ro?i.cullFace(i.BACK):D===hc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):pe(i.CULL_FACE),P=D}function C(D){D!==O&&(G&&i.lineWidth(D),O=D)}function ft(D,ce,ee){D?(Z(i.POLYGON_OFFSET_FILL),(B!==ce||X!==ee)&&(i.polygonOffset(ce,ee),B=ce,X=ee)):pe(i.POLYGON_OFFSET_FILL)}function qe(D){D?Z(i.SCISSOR_TEST):pe(i.SCISSOR_TEST)}function tt(D){D===void 0&&(D=i.TEXTURE0+W-1),he!==D&&(i.activeTexture(D),he=D)}function ve(D,ce,ee){ee===void 0&&(he===null?ee=i.TEXTURE0+W-1:ee=he);let de=ae[ee];de===void 0&&(de={type:void 0,texture:void 0},ae[ee]=de),(de.type!==D||de.texture!==ce)&&(he!==ee&&(i.activeTexture(ee),he=ee),i.bindTexture(D,ce||Y[D]),de.type=D,de.texture=ce)}function T(){const D=ae[he];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function g(){try{i.compressedTexImage2D(...arguments)}catch(D){Ve("WebGLState:",D)}}function U(){try{i.compressedTexImage3D(...arguments)}catch(D){Ve("WebGLState:",D)}}function q(){try{i.texSubImage2D(...arguments)}catch(D){Ve("WebGLState:",D)}}function K(){try{i.texSubImage3D(...arguments)}catch(D){Ve("WebGLState:",D)}}function H(){try{i.compressedTexSubImage2D(...arguments)}catch(D){Ve("WebGLState:",D)}}function Se(){try{i.compressedTexSubImage3D(...arguments)}catch(D){Ve("WebGLState:",D)}}function ne(){try{i.texStorage2D(...arguments)}catch(D){Ve("WebGLState:",D)}}function xe(){try{i.texStorage3D(...arguments)}catch(D){Ve("WebGLState:",D)}}function Ae(){try{i.texImage2D(...arguments)}catch(D){Ve("WebGLState:",D)}}function Q(){try{i.texImage3D(...arguments)}catch(D){Ve("WebGLState:",D)}}function se(D){Ue.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),Ue.copy(D))}function ge(D){at.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),at.copy(D))}function Me(D,ce){let ee=c.get(ce);ee===void 0&&(ee=new WeakMap,c.set(ce,ee));let de=ee.get(D);de===void 0&&(de=i.getUniformBlockIndex(ce,D.name),ee.set(D,de))}function ie(D,ce){const de=c.get(ce).get(D);l.get(ce)!==de&&(i.uniformBlockBinding(ce,de,D.__bindingPointIndex),l.set(ce,de))}function Fe(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},he=null,ae={},u={},d=new WeakMap,p=[],_=null,M=!1,m=null,f=null,y=null,b=null,E=null,w=null,A=null,R=new ze(0,0,0),I=0,x=!1,S=null,P=null,O=null,B=null,X=null,Ue.set(0,0,i.canvas.width,i.canvas.height),at.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:Z,disable:pe,bindFramebuffer:Le,drawBuffers:_e,useProgram:We,setBlending:Ye,setMaterial:Qe,setFlipSided:Ne,setCullFace:dt,setLineWidth:C,setPolygonOffset:ft,setScissorTest:qe,activeTexture:tt,bindTexture:ve,unbindTexture:T,compressedTexImage2D:g,compressedTexImage3D:U,texImage2D:Ae,texImage3D:Q,updateUBOMapping:Me,uniformBlockBinding:ie,texStorage2D:ne,texStorage3D:xe,texSubImage2D:q,texSubImage3D:K,compressedTexSubImage2D:H,compressedTexSubImage3D:Se,scissor:se,viewport:ge,reset:Fe}}function vm(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Pe,h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(T,g){return p?new OffscreenCanvas(T,g):qi("canvas")}function M(T,g,U){let q=1;const K=ve(T);if((K.width>U||K.height>U)&&(q=U/Math.max(K.width,K.height)),q<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){const H=Math.floor(q*K.width),Se=Math.floor(q*K.height);u===void 0&&(u=_(H,Se));const ne=g?_(H,Se):u;return ne.width=H,ne.height=Se,ne.getContext("2d").drawImage(T,0,0,H,Se),Ce("WebGLRenderer: Texture has been resized from ("+K.width+"x"+K.height+") to ("+H+"x"+Se+")."),ne}else return"data"in T&&Ce("WebGLRenderer: Image in DataTexture is too big ("+K.width+"x"+K.height+")."),T;return T}function m(T){return T.generateMipmaps}function f(T){i.generateMipmap(T)}function y(T){return T.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?i.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function b(T,g,U,q,K=!1){if(T!==null){if(i[T]!==void 0)return i[T];Ce("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let H=g;if(g===i.RED&&(U===i.FLOAT&&(H=i.R32F),U===i.HALF_FLOAT&&(H=i.R16F),U===i.UNSIGNED_BYTE&&(H=i.R8)),g===i.RED_INTEGER&&(U===i.UNSIGNED_BYTE&&(H=i.R8UI),U===i.UNSIGNED_SHORT&&(H=i.R16UI),U===i.UNSIGNED_INT&&(H=i.R32UI),U===i.BYTE&&(H=i.R8I),U===i.SHORT&&(H=i.R16I),U===i.INT&&(H=i.R32I)),g===i.RG&&(U===i.FLOAT&&(H=i.RG32F),U===i.HALF_FLOAT&&(H=i.RG16F),U===i.UNSIGNED_BYTE&&(H=i.RG8)),g===i.RG_INTEGER&&(U===i.UNSIGNED_BYTE&&(H=i.RG8UI),U===i.UNSIGNED_SHORT&&(H=i.RG16UI),U===i.UNSIGNED_INT&&(H=i.RG32UI),U===i.BYTE&&(H=i.RG8I),U===i.SHORT&&(H=i.RG16I),U===i.INT&&(H=i.RG32I)),g===i.RGB_INTEGER&&(U===i.UNSIGNED_BYTE&&(H=i.RGB8UI),U===i.UNSIGNED_SHORT&&(H=i.RGB16UI),U===i.UNSIGNED_INT&&(H=i.RGB32UI),U===i.BYTE&&(H=i.RGB8I),U===i.SHORT&&(H=i.RGB16I),U===i.INT&&(H=i.RGB32I)),g===i.RGBA_INTEGER&&(U===i.UNSIGNED_BYTE&&(H=i.RGBA8UI),U===i.UNSIGNED_SHORT&&(H=i.RGBA16UI),U===i.UNSIGNED_INT&&(H=i.RGBA32UI),U===i.BYTE&&(H=i.RGBA8I),U===i.SHORT&&(H=i.RGBA16I),U===i.INT&&(H=i.RGBA32I)),g===i.RGB&&(U===i.UNSIGNED_INT_5_9_9_9_REV&&(H=i.RGB9_E5),U===i.UNSIGNED_INT_10F_11F_11F_REV&&(H=i.R11F_G11F_B10F)),g===i.RGBA){const Se=K?Is:He.getTransfer(q);U===i.FLOAT&&(H=i.RGBA32F),U===i.HALF_FLOAT&&(H=i.RGBA16F),U===i.UNSIGNED_BYTE&&(H=Se===je?i.SRGB8_ALPHA8:i.RGBA8),U===i.UNSIGNED_SHORT_4_4_4_4&&(H=i.RGBA4),U===i.UNSIGNED_SHORT_5_5_5_1&&(H=i.RGB5_A1)}return(H===i.R16F||H===i.R32F||H===i.RG16F||H===i.RG32F||H===i.RGBA16F||H===i.RGBA32F)&&e.get("EXT_color_buffer_float"),H}function E(T,g){let U;return T?g===null||g===an||g===Xi?U=i.DEPTH24_STENCIL8:g===en?U=i.DEPTH32F_STENCIL8:g===Wi&&(U=i.DEPTH24_STENCIL8,Ce("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):g===null||g===an||g===Xi?U=i.DEPTH_COMPONENT24:g===en?U=i.DEPTH_COMPONENT32F:g===Wi&&(U=i.DEPTH_COMPONENT16),U}function w(T,g){return m(T)===!0||T.isFramebufferTexture&&T.minFilter!==yt&&T.minFilter!==wt?Math.log2(Math.max(g.width,g.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?g.mipmaps.length:1}function A(T){const g=T.target;g.removeEventListener("dispose",A),I(g),g.isVideoTexture&&h.delete(g)}function R(T){const g=T.target;g.removeEventListener("dispose",R),S(g)}function I(T){const g=n.get(T);if(g.__webglInit===void 0)return;const U=T.source,q=d.get(U);if(q){const K=q[g.__cacheKey];K.usedTimes--,K.usedTimes===0&&x(T),Object.keys(q).length===0&&d.delete(U)}n.remove(T)}function x(T){const g=n.get(T);i.deleteTexture(g.__webglTexture);const U=T.source,q=d.get(U);delete q[g.__cacheKey],a.memory.textures--}function S(T){const g=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(g.__webglFramebuffer[q]))for(let K=0;K<g.__webglFramebuffer[q].length;K++)i.deleteFramebuffer(g.__webglFramebuffer[q][K]);else i.deleteFramebuffer(g.__webglFramebuffer[q]);g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer[q])}else{if(Array.isArray(g.__webglFramebuffer))for(let q=0;q<g.__webglFramebuffer.length;q++)i.deleteFramebuffer(g.__webglFramebuffer[q]);else i.deleteFramebuffer(g.__webglFramebuffer);if(g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer),g.__webglMultisampledFramebuffer&&i.deleteFramebuffer(g.__webglMultisampledFramebuffer),g.__webglColorRenderbuffer)for(let q=0;q<g.__webglColorRenderbuffer.length;q++)g.__webglColorRenderbuffer[q]&&i.deleteRenderbuffer(g.__webglColorRenderbuffer[q]);g.__webglDepthRenderbuffer&&i.deleteRenderbuffer(g.__webglDepthRenderbuffer)}const U=T.textures;for(let q=0,K=U.length;q<K;q++){const H=n.get(U[q]);H.__webglTexture&&(i.deleteTexture(H.__webglTexture),a.memory.textures--),n.remove(U[q])}n.remove(T)}let P=0;function O(){P=0}function B(){const T=P;return T>=s.maxTextures&&Ce("WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+s.maxTextures),P+=1,T}function X(T){const g=[];return g.push(T.wrapS),g.push(T.wrapT),g.push(T.wrapR||0),g.push(T.magFilter),g.push(T.minFilter),g.push(T.anisotropy),g.push(T.internalFormat),g.push(T.format),g.push(T.type),g.push(T.generateMipmaps),g.push(T.premultiplyAlpha),g.push(T.flipY),g.push(T.unpackAlignment),g.push(T.colorSpace),g.join()}function W(T,g){const U=n.get(T);if(T.isVideoTexture&&qe(T),T.isRenderTargetTexture===!1&&T.isExternalTexture!==!0&&T.version>0&&U.__version!==T.version){const q=T.image;if(q===null)Ce("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)Ce("WebGLRenderer: Texture marked for update but image is incomplete");else{Y(U,T,g);return}}else T.isExternalTexture&&(U.__webglTexture=T.sourceTexture?T.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,U.__webglTexture,i.TEXTURE0+g)}function G(T,g){const U=n.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&U.__version!==T.version){Y(U,T,g);return}else T.isExternalTexture&&(U.__webglTexture=T.sourceTexture?T.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,U.__webglTexture,i.TEXTURE0+g)}function V(T,g){const U=n.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&U.__version!==T.version){Y(U,T,g);return}t.bindTexture(i.TEXTURE_3D,U.__webglTexture,i.TEXTURE0+g)}function j(T,g){const U=n.get(T);if(T.isCubeDepthTexture!==!0&&T.version>0&&U.__version!==T.version){Z(U,T,g);return}t.bindTexture(i.TEXTURE_CUBE_MAP,U.__webglTexture,i.TEXTURE0+g)}const he={[Gr]:i.REPEAT,[gn]:i.CLAMP_TO_EDGE,[Hr]:i.MIRRORED_REPEAT},ae={[yt]:i.NEAREST,[Dc]:i.NEAREST_MIPMAP_NEAREST,[es]:i.NEAREST_MIPMAP_LINEAR,[wt]:i.LINEAR,[js]:i.LINEAR_MIPMAP_NEAREST,[Xn]:i.LINEAR_MIPMAP_LINEAR},ue={[Nc]:i.NEVER,[kc]:i.ALWAYS,[Fc]:i.LESS,[Oa]:i.LEQUAL,[Oc]:i.EQUAL,[Ba]:i.GEQUAL,[Bc]:i.GREATER,[zc]:i.NOTEQUAL};function Oe(T,g){if(g.type===en&&e.has("OES_texture_float_linear")===!1&&(g.magFilter===wt||g.magFilter===js||g.magFilter===es||g.magFilter===Xn||g.minFilter===wt||g.minFilter===js||g.minFilter===es||g.minFilter===Xn)&&Ce("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(T,i.TEXTURE_WRAP_S,he[g.wrapS]),i.texParameteri(T,i.TEXTURE_WRAP_T,he[g.wrapT]),(T===i.TEXTURE_3D||T===i.TEXTURE_2D_ARRAY)&&i.texParameteri(T,i.TEXTURE_WRAP_R,he[g.wrapR]),i.texParameteri(T,i.TEXTURE_MAG_FILTER,ae[g.magFilter]),i.texParameteri(T,i.TEXTURE_MIN_FILTER,ae[g.minFilter]),g.compareFunction&&(i.texParameteri(T,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(T,i.TEXTURE_COMPARE_FUNC,ue[g.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(g.magFilter===yt||g.minFilter!==es&&g.minFilter!==Xn||g.type===en&&e.has("OES_texture_float_linear")===!1)return;if(g.anisotropy>1||n.get(g).__currentAnisotropy){const U=e.get("EXT_texture_filter_anisotropic");i.texParameterf(T,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(g.anisotropy,s.getMaxAnisotropy())),n.get(g).__currentAnisotropy=g.anisotropy}}}function Ue(T,g){let U=!1;T.__webglInit===void 0&&(T.__webglInit=!0,g.addEventListener("dispose",A));const q=g.source;let K=d.get(q);K===void 0&&(K={},d.set(q,K));const H=X(g);if(H!==T.__cacheKey){K[H]===void 0&&(K[H]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,U=!0),K[H].usedTimes++;const Se=K[T.__cacheKey];Se!==void 0&&(K[T.__cacheKey].usedTimes--,Se.usedTimes===0&&x(g)),T.__cacheKey=H,T.__webglTexture=K[H].texture}return U}function at(T,g,U){return Math.floor(Math.floor(T/U)/g)}function st(T,g,U,q){const H=T.updateRanges;if(H.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,g.width,g.height,U,q,g.data);else{H.sort((Q,se)=>Q.start-se.start);let Se=0;for(let Q=1;Q<H.length;Q++){const se=H[Se],ge=H[Q],Me=se.start+se.count,ie=at(ge.start,g.width,4),Fe=at(se.start,g.width,4);ge.start<=Me+1&&ie===Fe&&at(ge.start+ge.count-1,g.width,4)===ie?se.count=Math.max(se.count,ge.start+ge.count-se.start):(++Se,H[Se]=ge)}H.length=Se+1;const ne=i.getParameter(i.UNPACK_ROW_LENGTH),xe=i.getParameter(i.UNPACK_SKIP_PIXELS),Ae=i.getParameter(i.UNPACK_SKIP_ROWS);i.pixelStorei(i.UNPACK_ROW_LENGTH,g.width);for(let Q=0,se=H.length;Q<se;Q++){const ge=H[Q],Me=Math.floor(ge.start/4),ie=Math.ceil(ge.count/4),Fe=Me%g.width,D=Math.floor(Me/g.width),ce=ie,ee=1;i.pixelStorei(i.UNPACK_SKIP_PIXELS,Fe),i.pixelStorei(i.UNPACK_SKIP_ROWS,D),t.texSubImage2D(i.TEXTURE_2D,0,Fe,D,ce,ee,U,q,g.data)}T.clearUpdateRanges(),i.pixelStorei(i.UNPACK_ROW_LENGTH,ne),i.pixelStorei(i.UNPACK_SKIP_PIXELS,xe),i.pixelStorei(i.UNPACK_SKIP_ROWS,Ae)}}function Y(T,g,U){let q=i.TEXTURE_2D;(g.isDataArrayTexture||g.isCompressedArrayTexture)&&(q=i.TEXTURE_2D_ARRAY),g.isData3DTexture&&(q=i.TEXTURE_3D);const K=Ue(T,g),H=g.source;t.bindTexture(q,T.__webglTexture,i.TEXTURE0+U);const Se=n.get(H);if(H.version!==Se.__version||K===!0){t.activeTexture(i.TEXTURE0+U);const ne=He.getPrimaries(He.workingColorSpace),xe=g.colorSpace===Pn?null:He.getPrimaries(g.colorSpace),Ae=g.colorSpace===Pn||ne===xe?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae);let Q=M(g.image,!1,s.maxTextureSize);Q=tt(g,Q);const se=r.convert(g.format,g.colorSpace),ge=r.convert(g.type);let Me=b(g.internalFormat,se,ge,g.colorSpace,g.isVideoTexture);Oe(q,g);let ie;const Fe=g.mipmaps,D=g.isVideoTexture!==!0,ce=Se.__version===void 0||K===!0,ee=H.dataReady,de=w(g,Q);if(g.isDepthTexture)Me=E(g.format===qn,g.type),ce&&(D?t.texStorage2D(i.TEXTURE_2D,1,Me,Q.width,Q.height):t.texImage2D(i.TEXTURE_2D,0,Me,Q.width,Q.height,0,se,ge,null));else if(g.isDataTexture)if(Fe.length>0){D&&ce&&t.texStorage2D(i.TEXTURE_2D,de,Me,Fe[0].width,Fe[0].height);for(let J=0,$=Fe.length;J<$;J++)ie=Fe[J],D?ee&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,ie.width,ie.height,se,ge,ie.data):t.texImage2D(i.TEXTURE_2D,J,Me,ie.width,ie.height,0,se,ge,ie.data);g.generateMipmaps=!1}else D?(ce&&t.texStorage2D(i.TEXTURE_2D,de,Me,Q.width,Q.height),ee&&st(g,Q,se,ge)):t.texImage2D(i.TEXTURE_2D,0,Me,Q.width,Q.height,0,se,ge,Q.data);else if(g.isCompressedTexture)if(g.isCompressedArrayTexture){D&&ce&&t.texStorage3D(i.TEXTURE_2D_ARRAY,de,Me,Fe[0].width,Fe[0].height,Q.depth);for(let J=0,$=Fe.length;J<$;J++)if(ie=Fe[J],g.format!==$t)if(se!==null)if(D){if(ee)if(g.layerUpdates.size>0){const te=Oo(ie.width,ie.height,g.format,g.type);for(const Re of g.layerUpdates){const nt=ie.data.subarray(Re*te/ie.data.BYTES_PER_ELEMENT,(Re+1)*te/ie.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,Re,ie.width,ie.height,1,se,nt)}g.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,ie.width,ie.height,Q.depth,se,ie.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,J,Me,ie.width,ie.height,Q.depth,0,ie.data,0,0);else Ce("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else D?ee&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,ie.width,ie.height,Q.depth,se,ge,ie.data):t.texImage3D(i.TEXTURE_2D_ARRAY,J,Me,ie.width,ie.height,Q.depth,0,se,ge,ie.data)}else{D&&ce&&t.texStorage2D(i.TEXTURE_2D,de,Me,Fe[0].width,Fe[0].height);for(let J=0,$=Fe.length;J<$;J++)ie=Fe[J],g.format!==$t?se!==null?D?ee&&t.compressedTexSubImage2D(i.TEXTURE_2D,J,0,0,ie.width,ie.height,se,ie.data):t.compressedTexImage2D(i.TEXTURE_2D,J,Me,ie.width,ie.height,0,ie.data):Ce("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):D?ee&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,ie.width,ie.height,se,ge,ie.data):t.texImage2D(i.TEXTURE_2D,J,Me,ie.width,ie.height,0,se,ge,ie.data)}else if(g.isDataArrayTexture)if(D){if(ce&&t.texStorage3D(i.TEXTURE_2D_ARRAY,de,Me,Q.width,Q.height,Q.depth),ee)if(g.layerUpdates.size>0){const J=Oo(Q.width,Q.height,g.format,g.type);for(const $ of g.layerUpdates){const te=Q.data.subarray($*J/Q.data.BYTES_PER_ELEMENT,($+1)*J/Q.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,$,Q.width,Q.height,1,se,ge,te)}g.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,se,ge,Q.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Me,Q.width,Q.height,Q.depth,0,se,ge,Q.data);else if(g.isData3DTexture)D?(ce&&t.texStorage3D(i.TEXTURE_3D,de,Me,Q.width,Q.height,Q.depth),ee&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,se,ge,Q.data)):t.texImage3D(i.TEXTURE_3D,0,Me,Q.width,Q.height,Q.depth,0,se,ge,Q.data);else if(g.isFramebufferTexture){if(ce)if(D)t.texStorage2D(i.TEXTURE_2D,de,Me,Q.width,Q.height);else{let J=Q.width,$=Q.height;for(let te=0;te<de;te++)t.texImage2D(i.TEXTURE_2D,te,Me,J,$,0,se,ge,null),J>>=1,$>>=1}}else if(Fe.length>0){if(D&&ce){const J=ve(Fe[0]);t.texStorage2D(i.TEXTURE_2D,de,Me,J.width,J.height)}for(let J=0,$=Fe.length;J<$;J++)ie=Fe[J],D?ee&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,se,ge,ie):t.texImage2D(i.TEXTURE_2D,J,Me,se,ge,ie);g.generateMipmaps=!1}else if(D){if(ce){const J=ve(Q);t.texStorage2D(i.TEXTURE_2D,de,Me,J.width,J.height)}ee&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,se,ge,Q)}else t.texImage2D(i.TEXTURE_2D,0,Me,se,ge,Q);m(g)&&f(q),Se.__version=H.version,g.onUpdate&&g.onUpdate(g)}T.__version=g.version}function Z(T,g,U){if(g.image.length!==6)return;const q=Ue(T,g),K=g.source;t.bindTexture(i.TEXTURE_CUBE_MAP,T.__webglTexture,i.TEXTURE0+U);const H=n.get(K);if(K.version!==H.__version||q===!0){t.activeTexture(i.TEXTURE0+U);const Se=He.getPrimaries(He.workingColorSpace),ne=g.colorSpace===Pn?null:He.getPrimaries(g.colorSpace),xe=g.colorSpace===Pn||Se===ne?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,xe);const Ae=g.isCompressedTexture||g.image[0].isCompressedTexture,Q=g.image[0]&&g.image[0].isDataTexture,se=[];for(let $=0;$<6;$++)!Ae&&!Q?se[$]=M(g.image[$],!0,s.maxCubemapSize):se[$]=Q?g.image[$].image:g.image[$],se[$]=tt(g,se[$]);const ge=se[0],Me=r.convert(g.format,g.colorSpace),ie=r.convert(g.type),Fe=b(g.internalFormat,Me,ie,g.colorSpace),D=g.isVideoTexture!==!0,ce=H.__version===void 0||q===!0,ee=K.dataReady;let de=w(g,ge);Oe(i.TEXTURE_CUBE_MAP,g);let J;if(Ae){D&&ce&&t.texStorage2D(i.TEXTURE_CUBE_MAP,de,Fe,ge.width,ge.height);for(let $=0;$<6;$++){J=se[$].mipmaps;for(let te=0;te<J.length;te++){const Re=J[te];g.format!==$t?Me!==null?D?ee&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te,0,0,Re.width,Re.height,Me,Re.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te,Fe,Re.width,Re.height,0,Re.data):Ce("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?ee&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te,0,0,Re.width,Re.height,Me,ie,Re.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te,Fe,Re.width,Re.height,0,Me,ie,Re.data)}}}else{if(J=g.mipmaps,D&&ce){J.length>0&&de++;const $=ve(se[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,de,Fe,$.width,$.height)}for(let $=0;$<6;$++)if(Q){D?ee&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,se[$].width,se[$].height,Me,ie,se[$].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,Fe,se[$].width,se[$].height,0,Me,ie,se[$].data);for(let te=0;te<J.length;te++){const nt=J[te].image[$].image;D?ee&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te+1,0,0,nt.width,nt.height,Me,ie,nt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te+1,Fe,nt.width,nt.height,0,Me,ie,nt.data)}}else{D?ee&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,Me,ie,se[$]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,Fe,Me,ie,se[$]);for(let te=0;te<J.length;te++){const Re=J[te];D?ee&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te+1,0,0,Me,ie,Re.image[$]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+$,te+1,Fe,Me,ie,Re.image[$])}}}m(g)&&f(i.TEXTURE_CUBE_MAP),H.__version=K.version,g.onUpdate&&g.onUpdate(g)}T.__version=g.version}function pe(T,g,U,q,K,H){const Se=r.convert(U.format,U.colorSpace),ne=r.convert(U.type),xe=b(U.internalFormat,Se,ne,U.colorSpace),Ae=n.get(g),Q=n.get(U);if(Q.__renderTarget=g,!Ae.__hasExternalTextures){const se=Math.max(1,g.width>>H),ge=Math.max(1,g.height>>H);K===i.TEXTURE_3D||K===i.TEXTURE_2D_ARRAY?t.texImage3D(K,H,xe,se,ge,g.depth,0,Se,ne,null):t.texImage2D(K,H,xe,se,ge,0,Se,ne,null)}t.bindFramebuffer(i.FRAMEBUFFER,T),ft(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,q,K,Q.__webglTexture,0,C(g)):(K===i.TEXTURE_2D||K>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&K<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,q,K,Q.__webglTexture,H),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Le(T,g,U){if(i.bindRenderbuffer(i.RENDERBUFFER,T),g.depthBuffer){const q=g.depthTexture,K=q&&q.isDepthTexture?q.type:null,H=E(g.stencilBuffer,K),Se=g.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;ft(g)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,C(g),H,g.width,g.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,C(g),H,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,H,g.width,g.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Se,i.RENDERBUFFER,T)}else{const q=g.textures;for(let K=0;K<q.length;K++){const H=q[K],Se=r.convert(H.format,H.colorSpace),ne=r.convert(H.type),xe=b(H.internalFormat,Se,ne,H.colorSpace);ft(g)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,C(g),xe,g.width,g.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,C(g),xe,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,xe,g.width,g.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function _e(T,g,U){const q=g.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,T),!(g.depthTexture&&g.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=n.get(g.depthTexture);if(K.__renderTarget=g,(!K.__webglTexture||g.depthTexture.image.width!==g.width||g.depthTexture.image.height!==g.height)&&(g.depthTexture.image.width=g.width,g.depthTexture.image.height=g.height,g.depthTexture.needsUpdate=!0),q){if(K.__webglInit===void 0&&(K.__webglInit=!0,g.depthTexture.addEventListener("dispose",A)),K.__webglTexture===void 0){K.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),Oe(i.TEXTURE_CUBE_MAP,g.depthTexture);const Ae=r.convert(g.depthTexture.format),Q=r.convert(g.depthTexture.type);let se;g.depthTexture.format===Sn?se=i.DEPTH_COMPONENT24:g.depthTexture.format===qn&&(se=i.DEPTH24_STENCIL8);for(let ge=0;ge<6;ge++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,se,g.width,g.height,0,Ae,Q,null)}}else W(g.depthTexture,0);const H=K.__webglTexture,Se=C(g),ne=q?i.TEXTURE_CUBE_MAP_POSITIVE_X+U:i.TEXTURE_2D,xe=g.depthTexture.format===qn?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(g.depthTexture.format===Sn)ft(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,xe,ne,H,0,Se):i.framebufferTexture2D(i.FRAMEBUFFER,xe,ne,H,0);else if(g.depthTexture.format===qn)ft(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,xe,ne,H,0,Se):i.framebufferTexture2D(i.FRAMEBUFFER,xe,ne,H,0);else throw new Error("Unknown depthTexture format")}function We(T){const g=n.get(T),U=T.isWebGLCubeRenderTarget===!0;if(g.__boundDepthTexture!==T.depthTexture){const q=T.depthTexture;if(g.__depthDisposeCallback&&g.__depthDisposeCallback(),q){const K=()=>{delete g.__boundDepthTexture,delete g.__depthDisposeCallback,q.removeEventListener("dispose",K)};q.addEventListener("dispose",K),g.__depthDisposeCallback=K}g.__boundDepthTexture=q}if(T.depthTexture&&!g.__autoAllocateDepthBuffer)if(U)for(let q=0;q<6;q++)_e(g.__webglFramebuffer[q],T,q);else{const q=T.texture.mipmaps;q&&q.length>0?_e(g.__webglFramebuffer[0],T,0):_e(g.__webglFramebuffer,T,0)}else if(U){g.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[q]),g.__webglDepthbuffer[q]===void 0)g.__webglDepthbuffer[q]=i.createRenderbuffer(),Le(g.__webglDepthbuffer[q],T,!1);else{const K=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,H=g.__webglDepthbuffer[q];i.bindRenderbuffer(i.RENDERBUFFER,H),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,H)}}else{const q=T.texture.mipmaps;if(q&&q.length>0?t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer),g.__webglDepthbuffer===void 0)g.__webglDepthbuffer=i.createRenderbuffer(),Le(g.__webglDepthbuffer,T,!1);else{const K=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,H=g.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,H),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,H)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function xt(T,g,U){const q=n.get(T);g!==void 0&&pe(q.__webglFramebuffer,T,T.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),U!==void 0&&We(T)}function Ge(T){const g=T.texture,U=n.get(T),q=n.get(g);T.addEventListener("dispose",R);const K=T.textures,H=T.isWebGLCubeRenderTarget===!0,Se=K.length>1;if(Se||(q.__webglTexture===void 0&&(q.__webglTexture=i.createTexture()),q.__version=g.version,a.memory.textures++),H){U.__webglFramebuffer=[];for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0){U.__webglFramebuffer[ne]=[];for(let xe=0;xe<g.mipmaps.length;xe++)U.__webglFramebuffer[ne][xe]=i.createFramebuffer()}else U.__webglFramebuffer[ne]=i.createFramebuffer()}else{if(g.mipmaps&&g.mipmaps.length>0){U.__webglFramebuffer=[];for(let ne=0;ne<g.mipmaps.length;ne++)U.__webglFramebuffer[ne]=i.createFramebuffer()}else U.__webglFramebuffer=i.createFramebuffer();if(Se)for(let ne=0,xe=K.length;ne<xe;ne++){const Ae=n.get(K[ne]);Ae.__webglTexture===void 0&&(Ae.__webglTexture=i.createTexture(),a.memory.textures++)}if(T.samples>0&&ft(T)===!1){U.__webglMultisampledFramebuffer=i.createFramebuffer(),U.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let ne=0;ne<K.length;ne++){const xe=K[ne];U.__webglColorRenderbuffer[ne]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,U.__webglColorRenderbuffer[ne]);const Ae=r.convert(xe.format,xe.colorSpace),Q=r.convert(xe.type),se=b(xe.internalFormat,Ae,Q,xe.colorSpace,T.isXRRenderTarget===!0),ge=C(T);i.renderbufferStorageMultisample(i.RENDERBUFFER,ge,se,T.width,T.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ne,i.RENDERBUFFER,U.__webglColorRenderbuffer[ne])}i.bindRenderbuffer(i.RENDERBUFFER,null),T.depthBuffer&&(U.__webglDepthRenderbuffer=i.createRenderbuffer(),Le(U.__webglDepthRenderbuffer,T,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(H){t.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),Oe(i.TEXTURE_CUBE_MAP,g);for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0)for(let xe=0;xe<g.mipmaps.length;xe++)pe(U.__webglFramebuffer[ne][xe],T,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,xe);else pe(U.__webglFramebuffer[ne],T,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0);m(g)&&f(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Se){for(let ne=0,xe=K.length;ne<xe;ne++){const Ae=K[ne],Q=n.get(Ae);let se=i.TEXTURE_2D;(T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(se=T.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(se,Q.__webglTexture),Oe(se,Ae),pe(U.__webglFramebuffer,T,Ae,i.COLOR_ATTACHMENT0+ne,se,0),m(Ae)&&f(se)}t.unbindTexture()}else{let ne=i.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(ne=T.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ne,q.__webglTexture),Oe(ne,g),g.mipmaps&&g.mipmaps.length>0)for(let xe=0;xe<g.mipmaps.length;xe++)pe(U.__webglFramebuffer[xe],T,g,i.COLOR_ATTACHMENT0,ne,xe);else pe(U.__webglFramebuffer,T,g,i.COLOR_ATTACHMENT0,ne,0);m(g)&&f(ne),t.unbindTexture()}T.depthBuffer&&We(T)}function Ye(T){const g=T.textures;for(let U=0,q=g.length;U<q;U++){const K=g[U];if(m(K)){const H=y(T),Se=n.get(K).__webglTexture;t.bindTexture(H,Se),f(H),t.unbindTexture()}}}const Qe=[],Ne=[];function dt(T){if(T.samples>0){if(ft(T)===!1){const g=T.textures,U=T.width,q=T.height;let K=i.COLOR_BUFFER_BIT;const H=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Se=n.get(T),ne=g.length>1;if(ne)for(let Ae=0;Ae<g.length;Ae++)t.bindFramebuffer(i.FRAMEBUFFER,Se.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ae,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,Se.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ae,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,Se.__webglMultisampledFramebuffer);const xe=T.texture.mipmaps;xe&&xe.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Se.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Se.__webglFramebuffer);for(let Ae=0;Ae<g.length;Ae++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(K|=i.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(K|=i.STENCIL_BUFFER_BIT)),ne){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Se.__webglColorRenderbuffer[Ae]);const Q=n.get(g[Ae]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Q,0)}i.blitFramebuffer(0,0,U,q,0,0,U,q,K,i.NEAREST),l===!0&&(Qe.length=0,Ne.length=0,Qe.push(i.COLOR_ATTACHMENT0+Ae),T.depthBuffer&&T.resolveDepthBuffer===!1&&(Qe.push(H),Ne.push(H),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Ne)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Qe))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ne)for(let Ae=0;Ae<g.length;Ae++){t.bindFramebuffer(i.FRAMEBUFFER,Se.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ae,i.RENDERBUFFER,Se.__webglColorRenderbuffer[Ae]);const Q=n.get(g[Ae]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,Se.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ae,i.TEXTURE_2D,Q,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Se.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&l){const g=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[g])}}}function C(T){return Math.min(s.maxSamples,T.samples)}function ft(T){const g=n.get(T);return T.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&g.__useRenderToTexture!==!1}function qe(T){const g=a.render.frame;h.get(T)!==g&&(h.set(T,g),T.update())}function tt(T,g){const U=T.colorSpace,q=T.format,K=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||U!==Ei&&U!==Pn&&(He.getTransfer(U)===je?(q!==$t||K!==kt)&&Ce("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ve("WebGLTextures: Unsupported texture color space:",U)),g}function ve(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(c.width=T.naturalWidth||T.width,c.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(c.width=T.displayWidth,c.height=T.displayHeight):(c.width=T.width,c.height=T.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=O,this.setTexture2D=W,this.setTexture2DArray=G,this.setTexture3D=V,this.setTextureCube=j,this.rebindTextures=xt,this.setupRenderTarget=Ge,this.updateRenderTargetMipmap=Ye,this.updateMultisampleRenderTarget=dt,this.setupDepthRenderbuffer=We,this.setupFrameBufferTexture=pe,this.useMultisampledRTT=ft,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Mm(i,e){function t(n,s=Pn){let r;const a=He.getTransfer(s);if(n===kt)return i.UNSIGNED_BYTE;if(n===Da)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Ia)return i.UNSIGNED_SHORT_5_5_5_1;if(n===yl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===El)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Ml)return i.BYTE;if(n===Sl)return i.SHORT;if(n===Wi)return i.UNSIGNED_SHORT;if(n===La)return i.INT;if(n===an)return i.UNSIGNED_INT;if(n===en)return i.FLOAT;if(n===Mn)return i.HALF_FLOAT;if(n===Tl)return i.ALPHA;if(n===bl)return i.RGB;if(n===$t)return i.RGBA;if(n===Sn)return i.DEPTH_COMPONENT;if(n===qn)return i.DEPTH_STENCIL;if(n===wl)return i.RED;if(n===Ua)return i.RED_INTEGER;if(n===yi)return i.RG;if(n===Na)return i.RG_INTEGER;if(n===Fa)return i.RGBA_INTEGER;if(n===Rs||n===Cs||n===Ps||n===Ls)if(a===je)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Rs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Cs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Rs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Cs)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Wr||n===Xr||n===qr||n===Yr)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Wr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Xr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===qr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Yr)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===$r||n===Kr||n===jr||n===Zr||n===Jr||n===Qr||n===ea)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===$r||n===Kr)return a===je?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===jr)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Zr)return r.COMPRESSED_R11_EAC;if(n===Jr)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Qr)return r.COMPRESSED_RG11_EAC;if(n===ea)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===ta||n===na||n===ia||n===sa||n===ra||n===aa||n===oa||n===la||n===ca||n===ha||n===ua||n===da||n===fa||n===pa)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===ta)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===na)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ia)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===sa)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===ra)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===aa)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===oa)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===la)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ca)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ha)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ua)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===da)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===fa)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===pa)return a===je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===ma||n===ga||n===_a)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===ma)return a===je?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ga)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===_a)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===xa||n===va||n===Ma||n===Sa)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===xa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===va)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ma)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Sa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Xi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const Sm=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,ym=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Em{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Vl(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new ln({vertexShader:Sm,fragmentShader:ym,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ot(new bi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Tm extends Ri{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,_=null;const M=typeof XRWebGLBinding<"u",m=new Em,f={},y=t.getContextAttributes();let b=null,E=null;const w=[],A=[],R=new Pe;let I=null;const x=new zt;x.viewport=new ht;const S=new zt;S.viewport=new ht;const P=[x,S],O=new Dh;let B=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let Z=w[Y];return Z===void 0&&(Z=new vr,w[Y]=Z),Z.getTargetRaySpace()},this.getControllerGrip=function(Y){let Z=w[Y];return Z===void 0&&(Z=new vr,w[Y]=Z),Z.getGripSpace()},this.getHand=function(Y){let Z=w[Y];return Z===void 0&&(Z=new vr,w[Y]=Z),Z.getHandSpace()};function W(Y){const Z=A.indexOf(Y.inputSource);if(Z===-1)return;const pe=w[Z];pe!==void 0&&(pe.update(Y.inputSource,Y.frame,c||a),pe.dispatchEvent({type:Y.type,data:Y.inputSource}))}function G(){s.removeEventListener("select",W),s.removeEventListener("selectstart",W),s.removeEventListener("selectend",W),s.removeEventListener("squeeze",W),s.removeEventListener("squeezestart",W),s.removeEventListener("squeezeend",W),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",V);for(let Y=0;Y<w.length;Y++){const Z=A[Y];Z!==null&&(A[Y]=null,w[Y].disconnect(Z))}B=null,X=null,m.reset();for(const Y in f)delete f[Y];e.setRenderTarget(b),p=null,d=null,u=null,s=null,E=null,st.stop(),n.isPresenting=!1,e.setPixelRatio(I),e.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&Ce("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&Ce("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u===null&&M&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(b=e.getRenderTarget(),s.addEventListener("select",W),s.addEventListener("selectstart",W),s.addEventListener("selectend",W),s.addEventListener("squeeze",W),s.addEventListener("squeezestart",W),s.addEventListener("squeezeend",W),s.addEventListener("end",G),s.addEventListener("inputsourceschange",V),y.xrCompatible!==!0&&await t.makeXRCompatible(),I=e.getPixelRatio(),e.getSize(R),M&&"createProjectionLayer"in XRWebGLBinding.prototype){let pe=null,Le=null,_e=null;y.depth&&(_e=y.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,pe=y.stencil?qn:Sn,Le=y.stencil?Xi:an);const We={colorFormat:t.RGBA8,depthFormat:_e,scaleFactor:r};u=this.getBinding(),d=u.createProjectionLayer(We),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),E=new rn(d.textureWidth,d.textureHeight,{format:$t,type:kt,depthTexture:new $i(d.textureWidth,d.textureHeight,Le,void 0,void 0,void 0,void 0,void 0,void 0,pe),stencilBuffer:y.stencil,colorSpace:e.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const pe={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,t,pe),s.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),E=new rn(p.framebufferWidth,p.framebufferHeight,{format:$t,type:kt,colorSpace:e.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),st.setContext(s),st.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function V(Y){for(let Z=0;Z<Y.removed.length;Z++){const pe=Y.removed[Z],Le=A.indexOf(pe);Le>=0&&(A[Le]=null,w[Le].disconnect(pe))}for(let Z=0;Z<Y.added.length;Z++){const pe=Y.added[Z];let Le=A.indexOf(pe);if(Le===-1){for(let We=0;We<w.length;We++)if(We>=A.length){A.push(pe),Le=We;break}else if(A[We]===null){A[We]=pe,Le=We;break}if(Le===-1)break}const _e=w[Le];_e&&_e.connect(pe)}}const j=new L,he=new L;function ae(Y,Z,pe){j.setFromMatrixPosition(Z.matrixWorld),he.setFromMatrixPosition(pe.matrixWorld);const Le=j.distanceTo(he),_e=Z.projectionMatrix.elements,We=pe.projectionMatrix.elements,xt=_e[14]/(_e[10]-1),Ge=_e[14]/(_e[10]+1),Ye=(_e[9]+1)/_e[5],Qe=(_e[9]-1)/_e[5],Ne=(_e[8]-1)/_e[0],dt=(We[8]+1)/We[0],C=xt*Ne,ft=xt*dt,qe=Le/(-Ne+dt),tt=qe*-Ne;if(Z.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(tt),Y.translateZ(qe),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),_e[10]===-1)Y.projectionMatrix.copy(Z.projectionMatrix),Y.projectionMatrixInverse.copy(Z.projectionMatrixInverse);else{const ve=xt+qe,T=Ge+qe,g=C-tt,U=ft+(Le-tt),q=Ye*Ge/T*ve,K=Qe*Ge/T*ve;Y.projectionMatrix.makePerspective(g,U,q,K,ve,T),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function ue(Y,Z){Z===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(Z.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let Z=Y.near,pe=Y.far;m.texture!==null&&(m.depthNear>0&&(Z=m.depthNear),m.depthFar>0&&(pe=m.depthFar)),O.near=S.near=x.near=Z,O.far=S.far=x.far=pe,(B!==O.near||X!==O.far)&&(s.updateRenderState({depthNear:O.near,depthFar:O.far}),B=O.near,X=O.far),O.layers.mask=Y.layers.mask|6,x.layers.mask=O.layers.mask&3,S.layers.mask=O.layers.mask&5;const Le=Y.parent,_e=O.cameras;ue(O,Le);for(let We=0;We<_e.length;We++)ue(_e[We],Le);_e.length===2?ae(O,x,S):O.projectionMatrix.copy(x.projectionMatrix),Oe(Y,O,Le)};function Oe(Y,Z,pe){pe===null?Y.matrix.copy(Z.matrixWorld):(Y.matrix.copy(pe.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(Z.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(Z.projectionMatrix),Y.projectionMatrixInverse.copy(Z.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Ea*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(O)},this.getCameraTexture=function(Y){return f[Y]};let Ue=null;function at(Y,Z){if(h=Z.getViewerPose(c||a),_=Z,h!==null){const pe=h.views;p!==null&&(e.setRenderTargetFramebuffer(E,p.framebuffer),e.setRenderTarget(E));let Le=!1;pe.length!==O.cameras.length&&(O.cameras.length=0,Le=!0);for(let Ge=0;Ge<pe.length;Ge++){const Ye=pe[Ge];let Qe=null;if(p!==null)Qe=p.getViewport(Ye);else{const dt=u.getViewSubImage(d,Ye);Qe=dt.viewport,Ge===0&&(e.setRenderTargetTextures(E,dt.colorTexture,dt.depthStencilTexture),e.setRenderTarget(E))}let Ne=P[Ge];Ne===void 0&&(Ne=new zt,Ne.layers.enable(Ge),Ne.viewport=new ht,P[Ge]=Ne),Ne.matrix.fromArray(Ye.transform.matrix),Ne.matrix.decompose(Ne.position,Ne.quaternion,Ne.scale),Ne.projectionMatrix.fromArray(Ye.projectionMatrix),Ne.projectionMatrixInverse.copy(Ne.projectionMatrix).invert(),Ne.viewport.set(Qe.x,Qe.y,Qe.width,Qe.height),Ge===0&&(O.matrix.copy(Ne.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),Le===!0&&O.cameras.push(Ne)}const _e=s.enabledFeatures;if(_e&&_e.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&M){u=n.getBinding();const Ge=u.getDepthInformation(pe[0]);Ge&&Ge.isValid&&Ge.texture&&m.init(Ge,s.renderState)}if(_e&&_e.includes("camera-access")&&M){e.state.unbindTexture(),u=n.getBinding();for(let Ge=0;Ge<pe.length;Ge++){const Ye=pe[Ge].camera;if(Ye){let Qe=f[Ye];Qe||(Qe=new Vl,f[Ye]=Qe);const Ne=u.getCameraImage(Ye);Qe.sourceTexture=Ne}}}}for(let pe=0;pe<w.length;pe++){const Le=A[pe],_e=w[pe];Le!==null&&_e!==void 0&&_e.update(Le,Z,c||a)}Ue&&Ue(Y,Z),Z.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Z}),_=null}const st=new Wl;st.setAnimationLoop(at),this.setAnimationLoop=function(Y){Ue=Y},this.dispose=function(){}}}const Gn=new on,bm=new rt;function wm(i,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,Il(i)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function s(m,f,y,b,E){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,E)):f.isMeshMatcapMaterial?(r(m,f),_(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),M(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,y,b):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===It&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===It&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const y=e.get(f),b=y.envMap,E=y.envMapRotation;b&&(m.envMap.value=b,Gn.copy(E),Gn.x*=-1,Gn.y*=-1,Gn.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(Gn.y*=-1,Gn.z*=-1),m.envMapRotation.value.setFromMatrix4(bm.makeRotationFromEuler(Gn)),m.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,y,b){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*y,m.scale.value=b*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,y){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===It&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=y.texture,m.transmissionSamplerSize.value.set(y.width,y.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function _(m,f){f.matcap&&(m.matcap.value=f.matcap)}function M(m,f){const y=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(y.matrixWorld),m.nearDistance.value=y.shadow.camera.near,m.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Am(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,b){const E=b.program;n.uniformBlockBinding(y,E)}function c(y,b){let E=s[y.id];E===void 0&&(_(y),E=h(y),s[y.id]=E,y.addEventListener("dispose",m));const w=b.program;n.updateUBOMapping(y,w);const A=e.render.frame;r[y.id]!==A&&(d(y),r[y.id]=A)}function h(y){const b=u();y.__bindingPointIndex=b;const E=i.createBuffer(),w=y.__size,A=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,w,A),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,E),E}function u(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return Ve("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(y){const b=s[y.id],E=y.uniforms,w=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let A=0,R=E.length;A<R;A++){const I=Array.isArray(E[A])?E[A]:[E[A]];for(let x=0,S=I.length;x<S;x++){const P=I[x];if(p(P,A,x,w)===!0){const O=P.__offset,B=Array.isArray(P.value)?P.value:[P.value];let X=0;for(let W=0;W<B.length;W++){const G=B[W],V=M(G);typeof G=="number"||typeof G=="boolean"?(P.__data[0]=G,i.bufferSubData(i.UNIFORM_BUFFER,O+X,P.__data)):G.isMatrix3?(P.__data[0]=G.elements[0],P.__data[1]=G.elements[1],P.__data[2]=G.elements[2],P.__data[3]=0,P.__data[4]=G.elements[3],P.__data[5]=G.elements[4],P.__data[6]=G.elements[5],P.__data[7]=0,P.__data[8]=G.elements[6],P.__data[9]=G.elements[7],P.__data[10]=G.elements[8],P.__data[11]=0):(G.toArray(P.__data,X),X+=V.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,O,P.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(y,b,E,w){const A=y.value,R=b+"_"+E;if(w[R]===void 0)return typeof A=="number"||typeof A=="boolean"?w[R]=A:w[R]=A.clone(),!0;{const I=w[R];if(typeof A=="number"||typeof A=="boolean"){if(I!==A)return w[R]=A,!0}else if(I.equals(A)===!1)return I.copy(A),!0}return!1}function _(y){const b=y.uniforms;let E=0;const w=16;for(let R=0,I=b.length;R<I;R++){const x=Array.isArray(b[R])?b[R]:[b[R]];for(let S=0,P=x.length;S<P;S++){const O=x[S],B=Array.isArray(O.value)?O.value:[O.value];for(let X=0,W=B.length;X<W;X++){const G=B[X],V=M(G),j=E%w,he=j%V.boundary,ae=j+he;E+=he,ae!==0&&w-ae<V.storage&&(E+=w-ae),O.__data=new Float32Array(V.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=E,E+=V.storage}}}const A=E%w;return A>0&&(E+=w-A),y.__size=E,y.__cache={},this}function M(y){const b={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(b.boundary=4,b.storage=4):y.isVector2?(b.boundary=8,b.storage=8):y.isVector3||y.isColor?(b.boundary=16,b.storage=12):y.isVector4?(b.boundary=16,b.storage=16):y.isMatrix3?(b.boundary=48,b.storage=48):y.isMatrix4?(b.boundary=64,b.storage=64):y.isTexture?Ce("WebGLRenderer: Texture samplers can not be part of an uniforms group."):Ce("WebGLRenderer: Unsupported uniform value type.",y),b}function m(y){const b=y.target;b.removeEventListener("dispose",m);const E=a.indexOf(b.__bindingPointIndex);a.splice(E,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function f(){for(const y in s)i.deleteBuffer(s[y]);a=[],s={},r={}}return{bind:l,update:c,dispose:f}}const Rm=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let jt=null;function Cm(){return jt===null&&(jt=new gh(Rm,16,16,yi,Mn),jt.name="DFG_LUT",jt.minFilter=wt,jt.magFilter=wt,jt.wrapS=gn,jt.wrapT=gn,jt.generateMipmaps=!1,jt.needsUpdate=!0),jt}class Pm{constructor(e={}){const{canvas:t=Vc(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:p=kt}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=n.getContextAttributes().alpha}else _=a;const M=p,m=new Set([Fa,Na,Ua]),f=new Set([kt,an,Wi,Xi,Da,Ia]),y=new Uint32Array(4),b=new Int32Array(4);let E=null,w=null;const A=[],R=[];let I=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=sn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const x=this;let S=!1;this._outputColorSpace=Bt;let P=0,O=0,B=null,X=-1,W=null;const G=new ht,V=new ht;let j=null;const he=new ze(0);let ae=0,ue=t.width,Oe=t.height,Ue=1,at=null,st=null;const Y=new ht(0,0,ue,Oe),Z=new ht(0,0,ue,Oe);let pe=!1;const Le=new Ha;let _e=!1,We=!1;const xt=new rt,Ge=new L,Ye=new ht,Qe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Ne=!1;function dt(){return B===null?Ue:1}let C=n;function ft(v,N){return t.getContext(v,N)}try{const v={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Ca}`),t.addEventListener("webglcontextlost",Re,!1),t.addEventListener("webglcontextrestored",nt,!1),t.addEventListener("webglcontextcreationerror",$e,!1),C===null){const N="webgl2";if(C=ft(N,v),C===null)throw ft(N)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(v){throw Ve("WebGLRenderer: "+v.message),v}let qe,tt,ve,T,g,U,q,K,H,Se,ne,xe,Ae,Q,se,ge,Me,ie,Fe,D,ce,ee,de,J;function $(){qe=new Cf(C),qe.init(),ee=new Mm(C,qe),tt=new Mf(C,qe,e,ee),ve=new xm(C,qe),tt.reversedDepthBuffer&&d&&ve.buffers.depth.setReversed(!0),T=new Df(C),g=new im,U=new vm(C,qe,ve,g,tt,ee,T),q=new yf(x),K=new Rf(x),H=new Nh(C),de=new xf(C,H),Se=new Pf(C,H,T,de),ne=new Uf(C,Se,H,T),Fe=new If(C,tt,U),ge=new Sf(g),xe=new nm(x,q,K,qe,tt,de,ge),Ae=new wm(x,g),Q=new rm,se=new um(qe),ie=new _f(x,q,K,ve,ne,_,l),Me=new gm(x,ne,tt),J=new Am(C,T,tt,ve),D=new vf(C,qe,T),ce=new Lf(C,qe,T),T.programs=xe.programs,x.capabilities=tt,x.extensions=qe,x.properties=g,x.renderLists=Q,x.shadowMap=Me,x.state=ve,x.info=T}$(),M!==kt&&(I=new Ff(M,t.width,t.height,s,r));const te=new Tm(x,C);this.xr=te,this.getContext=function(){return C},this.getContextAttributes=function(){return C.getContextAttributes()},this.forceContextLoss=function(){const v=qe.get("WEBGL_lose_context");v&&v.loseContext()},this.forceContextRestore=function(){const v=qe.get("WEBGL_lose_context");v&&v.restoreContext()},this.getPixelRatio=function(){return Ue},this.setPixelRatio=function(v){v!==void 0&&(Ue=v,this.setSize(ue,Oe,!1))},this.getSize=function(v){return v.set(ue,Oe)},this.setSize=function(v,N,k=!0){if(te.isPresenting){Ce("WebGLRenderer: Can't change size while VR device is presenting.");return}ue=v,Oe=N,t.width=Math.floor(v*Ue),t.height=Math.floor(N*Ue),k===!0&&(t.style.width=v+"px",t.style.height=N+"px"),I!==null&&I.setSize(t.width,t.height),this.setViewport(0,0,v,N)},this.getDrawingBufferSize=function(v){return v.set(ue*Ue,Oe*Ue).floor()},this.setDrawingBufferSize=function(v,N,k){ue=v,Oe=N,Ue=k,t.width=Math.floor(v*k),t.height=Math.floor(N*k),this.setViewport(0,0,v,N)},this.setEffects=function(v){if(M===kt){console.error("THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(v){for(let N=0;N<v.length;N++)if(v[N].isOutputPass===!0){console.warn("THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}I.setEffects(v||[])},this.getCurrentViewport=function(v){return v.copy(G)},this.getViewport=function(v){return v.copy(Y)},this.setViewport=function(v,N,k,z){v.isVector4?Y.set(v.x,v.y,v.z,v.w):Y.set(v,N,k,z),ve.viewport(G.copy(Y).multiplyScalar(Ue).round())},this.getScissor=function(v){return v.copy(Z)},this.setScissor=function(v,N,k,z){v.isVector4?Z.set(v.x,v.y,v.z,v.w):Z.set(v,N,k,z),ve.scissor(V.copy(Z).multiplyScalar(Ue).round())},this.getScissorTest=function(){return pe},this.setScissorTest=function(v){ve.setScissorTest(pe=v)},this.setOpaqueSort=function(v){at=v},this.setTransparentSort=function(v){st=v},this.getClearColor=function(v){return v.copy(ie.getClearColor())},this.setClearColor=function(){ie.setClearColor(...arguments)},this.getClearAlpha=function(){return ie.getClearAlpha()},this.setClearAlpha=function(){ie.setClearAlpha(...arguments)},this.clear=function(v=!0,N=!0,k=!0){let z=0;if(v){let F=!1;if(B!==null){const re=B.texture.format;F=m.has(re)}if(F){const re=B.texture.type,fe=f.has(re),le=ie.getClearColor(),me=ie.getClearAlpha(),ye=le.r,we=le.g,Te=le.b;fe?(y[0]=ye,y[1]=we,y[2]=Te,y[3]=me,C.clearBufferuiv(C.COLOR,0,y)):(b[0]=ye,b[1]=we,b[2]=Te,b[3]=me,C.clearBufferiv(C.COLOR,0,b))}else z|=C.COLOR_BUFFER_BIT}N&&(z|=C.DEPTH_BUFFER_BIT),k&&(z|=C.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),C.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",Re,!1),t.removeEventListener("webglcontextrestored",nt,!1),t.removeEventListener("webglcontextcreationerror",$e,!1),ie.dispose(),Q.dispose(),se.dispose(),g.dispose(),q.dispose(),K.dispose(),ne.dispose(),de.dispose(),J.dispose(),xe.dispose(),te.dispose(),te.removeEventListener("sessionstart",Ja),te.removeEventListener("sessionend",Qa),Nn.stop()};function Re(v){v.preventDefault(),Ns("WebGLRenderer: Context Lost."),S=!0}function nt(){Ns("WebGLRenderer: Context Restored."),S=!1;const v=T.autoReset,N=Me.enabled,k=Me.autoUpdate,z=Me.needsUpdate,F=Me.type;$(),T.autoReset=v,Me.enabled=N,Me.autoUpdate=k,Me.needsUpdate=z,Me.type=F}function $e(v){Ve("WebGLRenderer: A WebGL context could not be created. Reason: ",v.statusMessage)}function Kt(v){const N=v.target;N.removeEventListener("dispose",Kt),cn(N)}function cn(v){tc(v),g.remove(v)}function tc(v){const N=g.get(v).programs;N!==void 0&&(N.forEach(function(k){xe.releaseProgram(k)}),v.isShaderMaterial&&xe.releaseShaderCache(v))}this.renderBufferDirect=function(v,N,k,z,F,re){N===null&&(N=Qe);const fe=F.isMesh&&F.matrixWorld.determinant()<0,le=ic(v,N,k,z,F);ve.setMaterial(z,fe);let me=k.index,ye=1;if(z.wireframe===!0){if(me=Se.getWireframeAttribute(k),me===void 0)return;ye=2}const we=k.drawRange,Te=k.attributes.position;let Be=we.start*ye,Ze=(we.start+we.count)*ye;re!==null&&(Be=Math.max(Be,re.start*ye),Ze=Math.min(Ze,(re.start+re.count)*ye)),me!==null?(Be=Math.max(Be,0),Ze=Math.min(Ze,me.count)):Te!=null&&(Be=Math.max(Be,0),Ze=Math.min(Ze,Te.count));const lt=Ze-Be;if(lt<0||lt===1/0)return;de.setup(F,z,le,k,me);let ct,et=D;if(me!==null&&(ct=H.get(me),et=ce,et.setIndex(ct)),F.isMesh)z.wireframe===!0?(ve.setLineWidth(z.wireframeLinewidth*dt()),et.setMode(C.LINES)):et.setMode(C.TRIANGLES);else if(F.isLine){let be=z.linewidth;be===void 0&&(be=1),ve.setLineWidth(be*dt()),F.isLineSegments?et.setMode(C.LINES):F.isLineLoop?et.setMode(C.LINE_LOOP):et.setMode(C.LINE_STRIP)}else F.isPoints?et.setMode(C.POINTS):F.isSprite&&et.setMode(C.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)Yi("WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),et.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(qe.get("WEBGL_multi_draw"))et.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const be=F._multiDrawStarts,Ke=F._multiDrawCounts,Xe=F._multiDrawCount,Ut=me?H.get(me).bytesPerElement:1,Zn=g.get(z).currentProgram.getUniforms();for(let Nt=0;Nt<Xe;Nt++)Zn.setValue(C,"_gl_DrawID",Nt),et.render(be[Nt]/Ut,Ke[Nt])}else if(F.isInstancedMesh)et.renderInstances(Be,lt,F.count);else if(k.isInstancedBufferGeometry){const be=k._maxInstanceCount!==void 0?k._maxInstanceCount:1/0,Ke=Math.min(k.instanceCount,be);et.renderInstances(Be,lt,Ke)}else et.render(Be,lt)};function Za(v,N,k){v.transparent===!0&&v.side===mn&&v.forceSinglePass===!1?(v.side=It,v.needsUpdate=!0,Qi(v,N,k),v.side=Un,v.needsUpdate=!0,Qi(v,N,k),v.side=mn):Qi(v,N,k)}this.compile=function(v,N,k=null){k===null&&(k=v),w=se.get(k),w.init(N),R.push(w),k.traverseVisible(function(F){F.isLight&&F.layers.test(N.layers)&&(w.pushLight(F),F.castShadow&&w.pushShadow(F))}),v!==k&&v.traverseVisible(function(F){F.isLight&&F.layers.test(N.layers)&&(w.pushLight(F),F.castShadow&&w.pushShadow(F))}),w.setupLights();const z=new Set;return v.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const re=F.material;if(re)if(Array.isArray(re))for(let fe=0;fe<re.length;fe++){const le=re[fe];Za(le,k,F),z.add(le)}else Za(re,k,F),z.add(re)}),w=R.pop(),z},this.compileAsync=function(v,N,k=null){const z=this.compile(v,N,k);return new Promise(F=>{function re(){if(z.forEach(function(fe){g.get(fe).currentProgram.isReady()&&z.delete(fe)}),z.size===0){F(v);return}setTimeout(re,10)}qe.get("KHR_parallel_shader_compile")!==null?re():setTimeout(re,10)})};let Ys=null;function nc(v){Ys&&Ys(v)}function Ja(){Nn.stop()}function Qa(){Nn.start()}const Nn=new Wl;Nn.setAnimationLoop(nc),typeof self<"u"&&Nn.setContext(self),this.setAnimationLoop=function(v){Ys=v,te.setAnimationLoop(v),v===null?Nn.stop():Nn.start()},te.addEventListener("sessionstart",Ja),te.addEventListener("sessionend",Qa),this.render=function(v,N){if(N!==void 0&&N.isCamera!==!0){Ve("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(S===!0)return;const k=te.enabled===!0&&te.isPresenting===!0,z=I!==null&&(B===null||k)&&I.begin(x,B);if(v.matrixWorldAutoUpdate===!0&&v.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),te.enabled===!0&&te.isPresenting===!0&&(I===null||I.isCompositing()===!1)&&(te.cameraAutoUpdate===!0&&te.updateCamera(N),N=te.getCamera()),v.isScene===!0&&v.onBeforeRender(x,v,N,B),w=se.get(v,R.length),w.init(N),R.push(w),xt.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),Le.setFromProjectionMatrix(xt,tn,N.reversedDepth),We=this.localClippingEnabled,_e=ge.init(this.clippingPlanes,We),E=Q.get(v,A.length),E.init(),A.push(E),te.enabled===!0&&te.isPresenting===!0){const fe=x.xr.getDepthSensingMesh();fe!==null&&$s(fe,N,-1/0,x.sortObjects)}$s(v,N,0,x.sortObjects),E.finish(),x.sortObjects===!0&&E.sort(at,st),Ne=te.enabled===!1||te.isPresenting===!1||te.hasDepthSensing()===!1,Ne&&ie.addToRenderList(E,v),this.info.render.frame++,_e===!0&&ge.beginShadows();const F=w.state.shadowsArray;if(Me.render(F,v,N),_e===!0&&ge.endShadows(),this.info.autoReset===!0&&this.info.reset(),(z&&I.hasRenderPass())===!1){const fe=E.opaque,le=E.transmissive;if(w.setupLights(),N.isArrayCamera){const me=N.cameras;if(le.length>0)for(let ye=0,we=me.length;ye<we;ye++){const Te=me[ye];to(fe,le,v,Te)}Ne&&ie.render(v);for(let ye=0,we=me.length;ye<we;ye++){const Te=me[ye];eo(E,v,Te,Te.viewport)}}else le.length>0&&to(fe,le,v,N),Ne&&ie.render(v),eo(E,v,N)}B!==null&&O===0&&(U.updateMultisampleRenderTarget(B),U.updateRenderTargetMipmap(B)),z&&I.end(x),v.isScene===!0&&v.onAfterRender(x,v,N),de.resetDefaultState(),X=-1,W=null,R.pop(),R.length>0?(w=R[R.length-1],_e===!0&&ge.setGlobalState(x.clippingPlanes,w.state.camera)):w=null,A.pop(),A.length>0?E=A[A.length-1]:E=null};function $s(v,N,k,z){if(v.visible===!1)return;if(v.layers.test(N.layers)){if(v.isGroup)k=v.renderOrder;else if(v.isLOD)v.autoUpdate===!0&&v.update(N);else if(v.isLight)w.pushLight(v),v.castShadow&&w.pushShadow(v);else if(v.isSprite){if(!v.frustumCulled||Le.intersectsSprite(v)){z&&Ye.setFromMatrixPosition(v.matrixWorld).applyMatrix4(xt);const fe=ne.update(v),le=v.material;le.visible&&E.push(v,fe,le,k,Ye.z,null)}}else if((v.isMesh||v.isLine||v.isPoints)&&(!v.frustumCulled||Le.intersectsObject(v))){const fe=ne.update(v),le=v.material;if(z&&(v.boundingSphere!==void 0?(v.boundingSphere===null&&v.computeBoundingSphere(),Ye.copy(v.boundingSphere.center)):(fe.boundingSphere===null&&fe.computeBoundingSphere(),Ye.copy(fe.boundingSphere.center)),Ye.applyMatrix4(v.matrixWorld).applyMatrix4(xt)),Array.isArray(le)){const me=fe.groups;for(let ye=0,we=me.length;ye<we;ye++){const Te=me[ye],Be=le[Te.materialIndex];Be&&Be.visible&&E.push(v,fe,Be,k,Ye.z,Te)}}else le.visible&&E.push(v,fe,le,k,Ye.z,null)}}const re=v.children;for(let fe=0,le=re.length;fe<le;fe++)$s(re[fe],N,k,z)}function eo(v,N,k,z){const{opaque:F,transmissive:re,transparent:fe}=v;w.setupLightsView(k),_e===!0&&ge.setGlobalState(x.clippingPlanes,k),z&&ve.viewport(G.copy(z)),F.length>0&&Ji(F,N,k),re.length>0&&Ji(re,N,k),fe.length>0&&Ji(fe,N,k),ve.buffers.depth.setTest(!0),ve.buffers.depth.setMask(!0),ve.buffers.color.setMask(!0),ve.setPolygonOffset(!1)}function to(v,N,k,z){if((k.isScene===!0?k.overrideMaterial:null)!==null)return;if(w.state.transmissionRenderTarget[z.id]===void 0){const Be=qe.has("EXT_color_buffer_half_float")||qe.has("EXT_color_buffer_float");w.state.transmissionRenderTarget[z.id]=new rn(1,1,{generateMipmaps:!0,type:Be?Mn:kt,minFilter:Xn,samples:tt.samples,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:He.workingColorSpace})}const re=w.state.transmissionRenderTarget[z.id],fe=z.viewport||G;re.setSize(fe.z*x.transmissionResolutionScale,fe.w*x.transmissionResolutionScale);const le=x.getRenderTarget(),me=x.getActiveCubeFace(),ye=x.getActiveMipmapLevel();x.setRenderTarget(re),x.getClearColor(he),ae=x.getClearAlpha(),ae<1&&x.setClearColor(16777215,.5),x.clear(),Ne&&ie.render(k);const we=x.toneMapping;x.toneMapping=sn;const Te=z.viewport;if(z.viewport!==void 0&&(z.viewport=void 0),w.setupLightsView(z),_e===!0&&ge.setGlobalState(x.clippingPlanes,z),Ji(v,k,z),U.updateMultisampleRenderTarget(re),U.updateRenderTargetMipmap(re),qe.has("WEBGL_multisampled_render_to_texture")===!1){let Be=!1;for(let Ze=0,lt=N.length;Ze<lt;Ze++){const ct=N[Ze],{object:et,geometry:be,material:Ke,group:Xe}=ct;if(Ke.side===mn&&et.layers.test(z.layers)){const Ut=Ke.side;Ke.side=It,Ke.needsUpdate=!0,no(et,k,z,be,Ke,Xe),Ke.side=Ut,Ke.needsUpdate=!0,Be=!0}}Be===!0&&(U.updateMultisampleRenderTarget(re),U.updateRenderTargetMipmap(re))}x.setRenderTarget(le,me,ye),x.setClearColor(he,ae),Te!==void 0&&(z.viewport=Te),x.toneMapping=we}function Ji(v,N,k){const z=N.isScene===!0?N.overrideMaterial:null;for(let F=0,re=v.length;F<re;F++){const fe=v[F],{object:le,geometry:me,group:ye}=fe;let we=fe.material;we.allowOverride===!0&&z!==null&&(we=z),le.layers.test(k.layers)&&no(le,N,k,me,we,ye)}}function no(v,N,k,z,F,re){v.onBeforeRender(x,N,k,z,F,re),v.modelViewMatrix.multiplyMatrices(k.matrixWorldInverse,v.matrixWorld),v.normalMatrix.getNormalMatrix(v.modelViewMatrix),F.onBeforeRender(x,N,k,z,v,re),F.transparent===!0&&F.side===mn&&F.forceSinglePass===!1?(F.side=It,F.needsUpdate=!0,x.renderBufferDirect(k,N,z,F,v,re),F.side=Un,F.needsUpdate=!0,x.renderBufferDirect(k,N,z,F,v,re),F.side=mn):x.renderBufferDirect(k,N,z,F,v,re),v.onAfterRender(x,N,k,z,F,re)}function Qi(v,N,k){N.isScene!==!0&&(N=Qe);const z=g.get(v),F=w.state.lights,re=w.state.shadowsArray,fe=F.state.version,le=xe.getParameters(v,F.state,re,N,k),me=xe.getProgramCacheKey(le);let ye=z.programs;z.environment=v.isMeshStandardMaterial?N.environment:null,z.fog=N.fog,z.envMap=(v.isMeshStandardMaterial?K:q).get(v.envMap||z.environment),z.envMapRotation=z.environment!==null&&v.envMap===null?N.environmentRotation:v.envMapRotation,ye===void 0&&(v.addEventListener("dispose",Kt),ye=new Map,z.programs=ye);let we=ye.get(me);if(we!==void 0){if(z.currentProgram===we&&z.lightsStateVersion===fe)return so(v,le),we}else le.uniforms=xe.getUniforms(v),v.onBeforeCompile(le,x),we=xe.acquireProgram(le,me),ye.set(me,we),z.uniforms=le.uniforms;const Te=z.uniforms;return(!v.isShaderMaterial&&!v.isRawShaderMaterial||v.clipping===!0)&&(Te.clippingPlanes=ge.uniform),so(v,le),z.needsLights=rc(v),z.lightsStateVersion=fe,z.needsLights&&(Te.ambientLightColor.value=F.state.ambient,Te.lightProbe.value=F.state.probe,Te.directionalLights.value=F.state.directional,Te.directionalLightShadows.value=F.state.directionalShadow,Te.spotLights.value=F.state.spot,Te.spotLightShadows.value=F.state.spotShadow,Te.rectAreaLights.value=F.state.rectArea,Te.ltc_1.value=F.state.rectAreaLTC1,Te.ltc_2.value=F.state.rectAreaLTC2,Te.pointLights.value=F.state.point,Te.pointLightShadows.value=F.state.pointShadow,Te.hemisphereLights.value=F.state.hemi,Te.directionalShadowMap.value=F.state.directionalShadowMap,Te.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Te.spotShadowMap.value=F.state.spotShadowMap,Te.spotLightMatrix.value=F.state.spotLightMatrix,Te.spotLightMap.value=F.state.spotLightMap,Te.pointShadowMap.value=F.state.pointShadowMap,Te.pointShadowMatrix.value=F.state.pointShadowMatrix),z.currentProgram=we,z.uniformsList=null,we}function io(v){if(v.uniformsList===null){const N=v.currentProgram.getUniforms();v.uniformsList=Ds.seqWithValue(N.seq,v.uniforms)}return v.uniformsList}function so(v,N){const k=g.get(v);k.outputColorSpace=N.outputColorSpace,k.batching=N.batching,k.batchingColor=N.batchingColor,k.instancing=N.instancing,k.instancingColor=N.instancingColor,k.instancingMorph=N.instancingMorph,k.skinning=N.skinning,k.morphTargets=N.morphTargets,k.morphNormals=N.morphNormals,k.morphColors=N.morphColors,k.morphTargetsCount=N.morphTargetsCount,k.numClippingPlanes=N.numClippingPlanes,k.numIntersection=N.numClipIntersection,k.vertexAlphas=N.vertexAlphas,k.vertexTangents=N.vertexTangents,k.toneMapping=N.toneMapping}function ic(v,N,k,z,F){N.isScene!==!0&&(N=Qe),U.resetTextureUnits();const re=N.fog,fe=z.isMeshStandardMaterial?N.environment:null,le=B===null?x.outputColorSpace:B.isXRRenderTarget===!0?B.texture.colorSpace:Ei,me=(z.isMeshStandardMaterial?K:q).get(z.envMap||fe),ye=z.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,we=!!k.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),Te=!!k.morphAttributes.position,Be=!!k.morphAttributes.normal,Ze=!!k.morphAttributes.color;let lt=sn;z.toneMapped&&(B===null||B.isXRRenderTarget===!0)&&(lt=x.toneMapping);const ct=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,et=ct!==void 0?ct.length:0,be=g.get(z),Ke=w.state.lights;if(_e===!0&&(We===!0||v!==W)){const At=v===W&&z.id===X;ge.setState(z,v,At)}let Xe=!1;z.version===be.__version?(be.needsLights&&be.lightsStateVersion!==Ke.state.version||be.outputColorSpace!==le||F.isBatchedMesh&&be.batching===!1||!F.isBatchedMesh&&be.batching===!0||F.isBatchedMesh&&be.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&be.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&be.instancing===!1||!F.isInstancedMesh&&be.instancing===!0||F.isSkinnedMesh&&be.skinning===!1||!F.isSkinnedMesh&&be.skinning===!0||F.isInstancedMesh&&be.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&be.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&be.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&be.instancingMorph===!1&&F.morphTexture!==null||be.envMap!==me||z.fog===!0&&be.fog!==re||be.numClippingPlanes!==void 0&&(be.numClippingPlanes!==ge.numPlanes||be.numIntersection!==ge.numIntersection)||be.vertexAlphas!==ye||be.vertexTangents!==we||be.morphTargets!==Te||be.morphNormals!==Be||be.morphColors!==Ze||be.toneMapping!==lt||be.morphTargetsCount!==et)&&(Xe=!0):(Xe=!0,be.__version=z.version);let Ut=be.currentProgram;Xe===!0&&(Ut=Qi(z,N,F));let Zn=!1,Nt=!1,Li=!1;const it=Ut.getUniforms(),Lt=be.uniforms;if(ve.useProgram(Ut.program)&&(Zn=!0,Nt=!0,Li=!0),z.id!==X&&(X=z.id,Nt=!0),Zn||W!==v){ve.buffers.depth.getReversed()&&v.reversedDepth!==!0&&(v._reversedDepth=!0,v.updateProjectionMatrix()),it.setValue(C,"projectionMatrix",v.projectionMatrix),it.setValue(C,"viewMatrix",v.matrixWorldInverse);const Dt=it.map.cameraPosition;Dt!==void 0&&Dt.setValue(C,Ge.setFromMatrixPosition(v.matrixWorld)),tt.logarithmicDepthBuffer&&it.setValue(C,"logDepthBufFC",2/(Math.log(v.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&it.setValue(C,"isOrthographic",v.isOrthographicCamera===!0),W!==v&&(W=v,Nt=!0,Li=!0)}if(be.needsLights&&(Ke.state.directionalShadowMap.length>0&&it.setValue(C,"directionalShadowMap",Ke.state.directionalShadowMap,U),Ke.state.spotShadowMap.length>0&&it.setValue(C,"spotShadowMap",Ke.state.spotShadowMap,U),Ke.state.pointShadowMap.length>0&&it.setValue(C,"pointShadowMap",Ke.state.pointShadowMap,U)),F.isSkinnedMesh){it.setOptional(C,F,"bindMatrix"),it.setOptional(C,F,"bindMatrixInverse");const At=F.skeleton;At&&(At.boneTexture===null&&At.computeBoneTexture(),it.setValue(C,"boneTexture",At.boneTexture,U))}F.isBatchedMesh&&(it.setOptional(C,F,"batchingTexture"),it.setValue(C,"batchingTexture",F._matricesTexture,U),it.setOptional(C,F,"batchingIdTexture"),it.setValue(C,"batchingIdTexture",F._indirectTexture,U),it.setOptional(C,F,"batchingColorTexture"),F._colorsTexture!==null&&it.setValue(C,"batchingColorTexture",F._colorsTexture,U));const Vt=k.morphAttributes;if((Vt.position!==void 0||Vt.normal!==void 0||Vt.color!==void 0)&&Fe.update(F,k,Ut),(Nt||be.receiveShadow!==F.receiveShadow)&&(be.receiveShadow=F.receiveShadow,it.setValue(C,"receiveShadow",F.receiveShadow)),z.isMeshGouraudMaterial&&z.envMap!==null&&(Lt.envMap.value=me,Lt.flipEnvMap.value=me.isCubeTexture&&me.isRenderTargetTexture===!1?-1:1),z.isMeshStandardMaterial&&z.envMap===null&&N.environment!==null&&(Lt.envMapIntensity.value=N.environmentIntensity),Lt.dfgLUT!==void 0&&(Lt.dfgLUT.value=Cm()),Nt&&(it.setValue(C,"toneMappingExposure",x.toneMappingExposure),be.needsLights&&sc(Lt,Li),re&&z.fog===!0&&Ae.refreshFogUniforms(Lt,re),Ae.refreshMaterialUniforms(Lt,z,Ue,Oe,w.state.transmissionRenderTarget[v.id]),Ds.upload(C,io(be),Lt,U)),z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(Ds.upload(C,io(be),Lt,U),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&it.setValue(C,"center",F.center),it.setValue(C,"modelViewMatrix",F.modelViewMatrix),it.setValue(C,"normalMatrix",F.normalMatrix),it.setValue(C,"modelMatrix",F.matrixWorld),z.isShaderMaterial||z.isRawShaderMaterial){const At=z.uniformsGroups;for(let Dt=0,Ks=At.length;Dt<Ks;Dt++){const Fn=At[Dt];J.update(Fn,Ut),J.bind(Fn,Ut)}}return Ut}function sc(v,N){v.ambientLightColor.needsUpdate=N,v.lightProbe.needsUpdate=N,v.directionalLights.needsUpdate=N,v.directionalLightShadows.needsUpdate=N,v.pointLights.needsUpdate=N,v.pointLightShadows.needsUpdate=N,v.spotLights.needsUpdate=N,v.spotLightShadows.needsUpdate=N,v.rectAreaLights.needsUpdate=N,v.hemisphereLights.needsUpdate=N}function rc(v){return v.isMeshLambertMaterial||v.isMeshToonMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isShadowMaterial||v.isShaderMaterial&&v.lights===!0}this.getActiveCubeFace=function(){return P},this.getActiveMipmapLevel=function(){return O},this.getRenderTarget=function(){return B},this.setRenderTargetTextures=function(v,N,k){const z=g.get(v);z.__autoAllocateDepthBuffer=v.resolveDepthBuffer===!1,z.__autoAllocateDepthBuffer===!1&&(z.__useRenderToTexture=!1),g.get(v.texture).__webglTexture=N,g.get(v.depthTexture).__webglTexture=z.__autoAllocateDepthBuffer?void 0:k,z.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(v,N){const k=g.get(v);k.__webglFramebuffer=N,k.__useDefaultFramebuffer=N===void 0};const ac=C.createFramebuffer();this.setRenderTarget=function(v,N=0,k=0){B=v,P=N,O=k;let z=null,F=!1,re=!1;if(v){const le=g.get(v);if(le.__useDefaultFramebuffer!==void 0){ve.bindFramebuffer(C.FRAMEBUFFER,le.__webglFramebuffer),G.copy(v.viewport),V.copy(v.scissor),j=v.scissorTest,ve.viewport(G),ve.scissor(V),ve.setScissorTest(j),X=-1;return}else if(le.__webglFramebuffer===void 0)U.setupRenderTarget(v);else if(le.__hasExternalTextures)U.rebindTextures(v,g.get(v.texture).__webglTexture,g.get(v.depthTexture).__webglTexture);else if(v.depthBuffer){const we=v.depthTexture;if(le.__boundDepthTexture!==we){if(we!==null&&g.has(we)&&(v.width!==we.image.width||v.height!==we.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");U.setupDepthRenderbuffer(v)}}const me=v.texture;(me.isData3DTexture||me.isDataArrayTexture||me.isCompressedArrayTexture)&&(re=!0);const ye=g.get(v).__webglFramebuffer;v.isWebGLCubeRenderTarget?(Array.isArray(ye[N])?z=ye[N][k]:z=ye[N],F=!0):v.samples>0&&U.useMultisampledRTT(v)===!1?z=g.get(v).__webglMultisampledFramebuffer:Array.isArray(ye)?z=ye[k]:z=ye,G.copy(v.viewport),V.copy(v.scissor),j=v.scissorTest}else G.copy(Y).multiplyScalar(Ue).floor(),V.copy(Z).multiplyScalar(Ue).floor(),j=pe;if(k!==0&&(z=ac),ve.bindFramebuffer(C.FRAMEBUFFER,z)&&ve.drawBuffers(v,z),ve.viewport(G),ve.scissor(V),ve.setScissorTest(j),F){const le=g.get(v.texture);C.framebufferTexture2D(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_CUBE_MAP_POSITIVE_X+N,le.__webglTexture,k)}else if(re){const le=N;for(let me=0;me<v.textures.length;me++){const ye=g.get(v.textures[me]);C.framebufferTextureLayer(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0+me,ye.__webglTexture,k,le)}}else if(v!==null&&k!==0){const le=g.get(v.texture);C.framebufferTexture2D(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,le.__webglTexture,k)}X=-1},this.readRenderTargetPixels=function(v,N,k,z,F,re,fe,le=0){if(!(v&&v.isWebGLRenderTarget)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let me=g.get(v).__webglFramebuffer;if(v.isWebGLCubeRenderTarget&&fe!==void 0&&(me=me[fe]),me){ve.bindFramebuffer(C.FRAMEBUFFER,me);try{const ye=v.textures[le],we=ye.format,Te=ye.type;if(!tt.textureFormatReadable(we)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!tt.textureTypeReadable(Te)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=v.width-z&&k>=0&&k<=v.height-F&&(v.textures.length>1&&C.readBuffer(C.COLOR_ATTACHMENT0+le),C.readPixels(N,k,z,F,ee.convert(we),ee.convert(Te),re))}finally{const ye=B!==null?g.get(B).__webglFramebuffer:null;ve.bindFramebuffer(C.FRAMEBUFFER,ye)}}},this.readRenderTargetPixelsAsync=async function(v,N,k,z,F,re,fe,le=0){if(!(v&&v.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let me=g.get(v).__webglFramebuffer;if(v.isWebGLCubeRenderTarget&&fe!==void 0&&(me=me[fe]),me)if(N>=0&&N<=v.width-z&&k>=0&&k<=v.height-F){ve.bindFramebuffer(C.FRAMEBUFFER,me);const ye=v.textures[le],we=ye.format,Te=ye.type;if(!tt.textureFormatReadable(we))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!tt.textureTypeReadable(Te))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Be=C.createBuffer();C.bindBuffer(C.PIXEL_PACK_BUFFER,Be),C.bufferData(C.PIXEL_PACK_BUFFER,re.byteLength,C.STREAM_READ),v.textures.length>1&&C.readBuffer(C.COLOR_ATTACHMENT0+le),C.readPixels(N,k,z,F,ee.convert(we),ee.convert(Te),0);const Ze=B!==null?g.get(B).__webglFramebuffer:null;ve.bindFramebuffer(C.FRAMEBUFFER,Ze);const lt=C.fenceSync(C.SYNC_GPU_COMMANDS_COMPLETE,0);return C.flush(),await Gc(C,lt,4),C.bindBuffer(C.PIXEL_PACK_BUFFER,Be),C.getBufferSubData(C.PIXEL_PACK_BUFFER,0,re),C.deleteBuffer(Be),C.deleteSync(lt),re}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(v,N=null,k=0){const z=Math.pow(2,-k),F=Math.floor(v.image.width*z),re=Math.floor(v.image.height*z),fe=N!==null?N.x:0,le=N!==null?N.y:0;U.setTexture2D(v,0),C.copyTexSubImage2D(C.TEXTURE_2D,k,0,0,fe,le,F,re),ve.unbindTexture()};const oc=C.createFramebuffer(),lc=C.createFramebuffer();this.copyTextureToTexture=function(v,N,k=null,z=null,F=0,re=null){re===null&&(F!==0?(Yi("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),re=F,F=0):re=0);let fe,le,me,ye,we,Te,Be,Ze,lt;const ct=v.isCompressedTexture?v.mipmaps[re]:v.image;if(k!==null)fe=k.max.x-k.min.x,le=k.max.y-k.min.y,me=k.isBox3?k.max.z-k.min.z:1,ye=k.min.x,we=k.min.y,Te=k.isBox3?k.min.z:0;else{const Vt=Math.pow(2,-F);fe=Math.floor(ct.width*Vt),le=Math.floor(ct.height*Vt),v.isDataArrayTexture?me=ct.depth:v.isData3DTexture?me=Math.floor(ct.depth*Vt):me=1,ye=0,we=0,Te=0}z!==null?(Be=z.x,Ze=z.y,lt=z.z):(Be=0,Ze=0,lt=0);const et=ee.convert(N.format),be=ee.convert(N.type);let Ke;N.isData3DTexture?(U.setTexture3D(N,0),Ke=C.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(U.setTexture2DArray(N,0),Ke=C.TEXTURE_2D_ARRAY):(U.setTexture2D(N,0),Ke=C.TEXTURE_2D),C.pixelStorei(C.UNPACK_FLIP_Y_WEBGL,N.flipY),C.pixelStorei(C.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),C.pixelStorei(C.UNPACK_ALIGNMENT,N.unpackAlignment);const Xe=C.getParameter(C.UNPACK_ROW_LENGTH),Ut=C.getParameter(C.UNPACK_IMAGE_HEIGHT),Zn=C.getParameter(C.UNPACK_SKIP_PIXELS),Nt=C.getParameter(C.UNPACK_SKIP_ROWS),Li=C.getParameter(C.UNPACK_SKIP_IMAGES);C.pixelStorei(C.UNPACK_ROW_LENGTH,ct.width),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,ct.height),C.pixelStorei(C.UNPACK_SKIP_PIXELS,ye),C.pixelStorei(C.UNPACK_SKIP_ROWS,we),C.pixelStorei(C.UNPACK_SKIP_IMAGES,Te);const it=v.isDataArrayTexture||v.isData3DTexture,Lt=N.isDataArrayTexture||N.isData3DTexture;if(v.isDepthTexture){const Vt=g.get(v),At=g.get(N),Dt=g.get(Vt.__renderTarget),Ks=g.get(At.__renderTarget);ve.bindFramebuffer(C.READ_FRAMEBUFFER,Dt.__webglFramebuffer),ve.bindFramebuffer(C.DRAW_FRAMEBUFFER,Ks.__webglFramebuffer);for(let Fn=0;Fn<me;Fn++)it&&(C.framebufferTextureLayer(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,g.get(v).__webglTexture,F,Te+Fn),C.framebufferTextureLayer(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,g.get(N).__webglTexture,re,lt+Fn)),C.blitFramebuffer(ye,we,fe,le,Be,Ze,fe,le,C.DEPTH_BUFFER_BIT,C.NEAREST);ve.bindFramebuffer(C.READ_FRAMEBUFFER,null),ve.bindFramebuffer(C.DRAW_FRAMEBUFFER,null)}else if(F!==0||v.isRenderTargetTexture||g.has(v)){const Vt=g.get(v),At=g.get(N);ve.bindFramebuffer(C.READ_FRAMEBUFFER,oc),ve.bindFramebuffer(C.DRAW_FRAMEBUFFER,lc);for(let Dt=0;Dt<me;Dt++)it?C.framebufferTextureLayer(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,Vt.__webglTexture,F,Te+Dt):C.framebufferTexture2D(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,Vt.__webglTexture,F),Lt?C.framebufferTextureLayer(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,At.__webglTexture,re,lt+Dt):C.framebufferTexture2D(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,At.__webglTexture,re),F!==0?C.blitFramebuffer(ye,we,fe,le,Be,Ze,fe,le,C.COLOR_BUFFER_BIT,C.NEAREST):Lt?C.copyTexSubImage3D(Ke,re,Be,Ze,lt+Dt,ye,we,fe,le):C.copyTexSubImage2D(Ke,re,Be,Ze,ye,we,fe,le);ve.bindFramebuffer(C.READ_FRAMEBUFFER,null),ve.bindFramebuffer(C.DRAW_FRAMEBUFFER,null)}else Lt?v.isDataTexture||v.isData3DTexture?C.texSubImage3D(Ke,re,Be,Ze,lt,fe,le,me,et,be,ct.data):N.isCompressedArrayTexture?C.compressedTexSubImage3D(Ke,re,Be,Ze,lt,fe,le,me,et,ct.data):C.texSubImage3D(Ke,re,Be,Ze,lt,fe,le,me,et,be,ct):v.isDataTexture?C.texSubImage2D(C.TEXTURE_2D,re,Be,Ze,fe,le,et,be,ct.data):v.isCompressedTexture?C.compressedTexSubImage2D(C.TEXTURE_2D,re,Be,Ze,ct.width,ct.height,et,ct.data):C.texSubImage2D(C.TEXTURE_2D,re,Be,Ze,fe,le,et,be,ct);C.pixelStorei(C.UNPACK_ROW_LENGTH,Xe),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,Ut),C.pixelStorei(C.UNPACK_SKIP_PIXELS,Zn),C.pixelStorei(C.UNPACK_SKIP_ROWS,Nt),C.pixelStorei(C.UNPACK_SKIP_IMAGES,Li),re===0&&N.generateMipmaps&&C.generateMipmap(Ke),ve.unbindTexture()},this.initRenderTarget=function(v){g.get(v).__webglFramebuffer===void 0&&U.setupRenderTarget(v)},this.initTexture=function(v){v.isCubeTexture?U.setTextureCube(v,0):v.isData3DTexture?U.setTexture3D(v,0):v.isDataArrayTexture||v.isCompressedArrayTexture?U.setTexture2DArray(v,0):U.setTexture2D(v,0),ve.unbindTexture()},this.resetState=function(){P=0,O=0,B=null,ve.reset(),de.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return tn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=He._getDrawingBufferColorSpace(e),t.unpackColorSpace=He._getUnpackColorSpace()}}class Xs{constructor(){this.callbacks={},this.callbacks.base={}}on(e,t){return typeof e>"u"||e===""?(console.warn("wrong names"),!1):typeof t>"u"?(console.warn("wrong callback"),!1):(this.resolveNames(e).forEach(s=>{const r=this.resolveName(s);this.callbacks[r.namespace]instanceof Object||(this.callbacks[r.namespace]={}),this.callbacks[r.namespace][r.value]instanceof Array||(this.callbacks[r.namespace][r.value]=[]),this.callbacks[r.namespace][r.value].push(t)}),this)}off(e){return typeof e>"u"||e===""?(console.warn("wrong name"),!1):(this.resolveNames(e).forEach(n=>{const s=this.resolveName(n);if(s.namespace!=="base"&&s.value==="")delete this.callbacks[s.namespace];else if(s.namespace==="base")for(const r in this.callbacks)this.callbacks[r]instanceof Object&&this.callbacks[r][s.value]instanceof Array&&(delete this.callbacks[r][s.value],Object.keys(this.callbacks[r]).length===0&&delete this.callbacks[r]);else this.callbacks[s.namespace]instanceof Object&&this.callbacks[s.namespace][s.value]instanceof Array&&(delete this.callbacks[s.namespace][s.value],Object.keys(this.callbacks[s.namespace]).length===0&&delete this.callbacks[s.namespace])}),this)}trigger(e,...t){if(typeof e>"u"||e==="")return console.warn("wrong name"),!1;let n=null;const s=t instanceof Array?t:[];let r=this.resolveNames(e);if(r=this.resolveName(r[0]),r.namespace==="base")for(const a in this.callbacks)this.callbacks[a]instanceof Object&&this.callbacks[a][r.value]instanceof Array&&this.callbacks[a][r.value].forEach(function(o){o.apply(this,s)});else if(this.callbacks[r.namespace]instanceof Object){if(r.value==="")return console.warn("wrong name"),this;this.callbacks[r.namespace][r.value].forEach(function(a){a.apply(this,s)})}return n}resolveNames(e){let t=e;return t=t.replace(/[^a-zA-Z0-9 ,/.]/g,""),t=t.replace(/[,/]+/g," "),t=t.split(" "),t}resolveName(e){const t={},n=e.split(".");return t.original=e,t.value=n[0],t.namespace="base",n.length>1&&n[1]!==""&&(t.namespace=n[1]),t}}class Lm extends Xs{constructor(){super(),this.width=window.innerWidth,this.height=window.innerHeight,this.pixelRatio=Math.min(window.devicePixelRatio,2),this.resizeDelay=300,this.resizeTimeout=null,window.addEventListener("resize",()=>{this.resizeTimeout&&clearTimeout(this.resizeTimeout),this.resizeTimeout=setTimeout(()=>{this.width=window.innerWidth,this.height=window.innerHeight,this.pixelRatio=Math.min(window.devicePixelRatio,2),this.trigger("resize")},this.resizeDelay)})}}class Dm extends Xs{constructor(){super(),this.start=Date.now(),this.current=this.start,this.elapsedTime=0,this.delta=0,this.maxDelta=.05,this.isPaused=!1,this.pauseStart=0,window.requestAnimationFrame(()=>this.animate())}animate(){const e=Date.now();this.isPaused?this.delta=0:(this.delta=Math.min((e-this.current)/1e3,this.maxDelta),this.current=e,this.elapsedTime=(this.current-this.start)/1e3,this.trigger("animate")),window.requestAnimationFrame(()=>this.animate())}pause(){this.isPaused||(this.isPaused=!0,this.pauseStart=Date.now())}resume(){if(!this.isPaused)return;this.isPaused=!1;const e=Date.now()-this.pauseStart;this.start+=e,this.current=Date.now()}}class Im{constructor(e=50,t=.1,n=220){this.game=Mt.getInstance(),this.sizes=this.game.sizes,this.scene=this.game.scene,this.cameraInstance=new zt(e,this.sizes.width/this.sizes.height,t,n),this.cameraInstance.position.set(0,26,16),this.cameraInstance.lookAt(0,0,0),this.scene.add(this.cameraInstance),this.offset=new L(0,25,14.5),this.lookAhead=new L}resize(){this.cameraInstance.aspect=this.sizes.width/this.sizes.height,this.cameraInstance.updateProjectionMatrix()}update(){}}class Um{constructor(){this.game=Mt.getInstance(),this.canvas=this.game.canvas,this.sizes=this.game.sizes,this.scene=this.game.scene,this.camera=this.game.camera,this.rendererInstance=new Pm({canvas:this.canvas,antialias:!0,powerPreference:"high-performance"}),this.rendererInstance.toneMapping=Pa,this.rendererInstance.toneMappingExposure=1.15,this.rendererInstance.shadowMap.enabled=!1,this.rendererInstance.setSize(this.sizes.width,this.sizes.height),this.rendererInstance.setPixelRatio(this.sizes.pixelRatio)}resize(){this.rendererInstance.setSize(this.sizes.width,this.sizes.height),this.rendererInstance.setPixelRatio(this.sizes.pixelRatio)}update(){this.rendererInstance.render(this.scene,this.camera.cameraInstance)}}class Nm{constructor(){this.entities=new Set,this.nextId=1,this.stores=new Map,this.systems=[],this._queryCache=new Map}create(){const e=this.nextId++;return this.entities.add(e),e}add(e,t,n){let s=this.stores.get(t);return s||(s=new Map,this.stores.set(t,s)),s.set(e,n),this._queryCache.clear(),n}get(e,t){const n=this.stores.get(t);return n?n.get(e):void 0}has(e,t){const n=this.stores.get(t);return n?n.has(e):!1}removeComponent(e,t){const n=this.stores.get(t);n&&n.delete(e),this._queryCache.clear()}destroy(e){for(const t of this.stores.values())t.delete(e);this.entities.delete(e),this._queryCache.clear()}query(...e){const t=e.join("|"),n=this._queryCache.get(t);if(n)return n;const s=this.stores.get(e[0]),r=[];if(s)e:for(const a of s.keys()){for(let o=1;o<e.length;o++){const l=this.stores.get(e[o]);if(!l||!l.has(a))continue e}r.push(a)}return this._queryCache.set(t,r),r}addSystem(e){return this.systems.push(e),e}update(e){for(const t of this.systems)t.update(e)}clear(){this.entities.clear(),this.stores.clear(),this._queryCache.clear()}}let bs=null;function Fm(){if(bs)return bs;const i=document.createElement("canvas");i.width=i.height=128;const e=i.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.25,"rgba(255,255,255,0.55)"),t.addColorStop(.6,"rgba(255,255,255,0.12)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),bs=new kl(i),bs}function Zi(i,e,t=.85){const n=new Ol({map:Fm(),color:i,transparent:!0,opacity:t,blending:Hi,depthWrite:!1}),s=new mh(n);return s.scale.setScalar(e),s}function Om(){const e=document.createElement("canvas");e.width=e.height=1024;const t=e.getContext("2d");t.fillStyle="#05060f",t.fillRect(0,0,1024,1024),t.strokeStyle="rgba(0,240,255,0.10)",t.lineWidth=1.5;for(let r=0;r<=1024;r+=64)t.beginPath(),t.moveTo(r,0),t.lineTo(r,1024),t.stroke(),t.beginPath(),t.moveTo(0,r),t.lineTo(1024,r),t.stroke();t.strokeStyle="rgba(0,240,255,0.28)",t.lineWidth=2.5;for(let r=0;r<=1024;r+=256)t.beginPath(),t.moveTo(r,0),t.lineTo(r,1024),t.stroke(),t.beginPath(),t.moveTo(0,r),t.lineTo(1024,r),t.stroke();const n=t.createRadialGradient(1024/2,1024/2,0,1024/2,1024/2,220);n.addColorStop(0,"rgba(255,45,149,0.16)"),n.addColorStop(1,"rgba(255,45,149,0)"),t.fillStyle=n,t.fillRect(0,0,1024,1024);const s=new kl(e);return s.anisotropy=4,s.colorSpace=Bt,s}const Pr={};function Ka(i,e=!0){i&&i.traverse(t=>{e&&t.isMesh&&t.geometry&&t.geometry.dispose(),t.material&&(Array.isArray(t.material)?t.material:[t.material]).forEach(s=>s.dispose())})}function Bm(i){if(Pr[i])return Pr[i];let e;switch(i){case"shard":e=new xi(.18);break;case"shardBig":e=new xi(.3);break;case"spark":e=new yn(.07,.07,.22);break;case"ring":e=new wi(.5,.045,6,40);break;case"ghost":e=new Vs(.42,1.15,4);break;default:e=new xi(.15)}return Pr[i]=e,e}const Ai=21;class zm{constructor(){this.game=Mt.getInstance(),this.scene=this.game.scene,this.group=new _n,this.scene.add(this.group),this.scene.background=new ze(197650),this.scene.fog=new Ga(197650,.014),this._buildFloor(),this._buildWalls(),this._buildCenter(),this._buildStars(),this._buildLights()}_buildFloor(){const e=Om(),t=Ai*2+2,n=new vi({map:e,emissive:61695,emissiveMap:e,emissiveIntensity:.32,roughness:.82,metalness:.25}),s=new ot(new bi(t,t),n);s.rotation.x=-Math.PI/2,this.group.add(s);const r=new ot(new bi(300,300),new nn({color:131850}));r.rotation.x=-Math.PI/2,r.position.y=-.06,this.group.add(r)}_buildWalls(){const e=Ai,t=new vi({color:659504,emissive:61695,emissiveIntensity:.55,roughness:.4,metalness:.6,transparent:!0,opacity:.92}),n=new nn({color:8385535}),s=e*2+.6,r=[{p:[0,.7,-e-.3],s:[s,1.4,.3]},{p:[0,.7,e+.3],s:[s,1.4,.3]},{p:[-e-.3,.7,0],s:[.3,1.4,s]},{p:[e+.3,.7,0],s:[.3,1.4,s]}];for(const{p:o,s:l}of r){const c=new ot(new yn(...l),t);c.position.set(...o),this.group.add(c);const h=new ot(new yn(l[0]===.3?.34:l[0],.06,l[2]===.3?.34:l[2]),n);h.position.set(o[0],1.42,o[2]),this.group.add(h)}const a=new vi({color:2098714,emissive:16723349,emissiveIntensity:1.1,roughness:.35,metalness:.5});for(const o of[-1,1])for(const l of[-1,1]){const c=new ot(new ks(.32,.46,3.4,6),a);c.position.set(o*e,1.7,l*e),this.group.add(c);const h=Zi(16723349,3.4,.5);h.position.set(o*e,3.4,l*e),this.group.add(h)}}_buildCenter(){const e=new nn({color:61695,transparent:!0,opacity:.8}),t=new ot(new wi(4,.06,8,72),e);t.rotation.x=-Math.PI/2,t.position.y=.03,this.group.add(t);const n=new ot(new wi(1.3,.05,8,48),new nn({color:16723349,transparent:!0,opacity:.85}));n.rotation.x=-Math.PI/2,n.position.y=.03,this.group.add(n),this.centerRing=n}_buildStars(){const t=new Float32Array(1260);for(let r=0;r<420;r++){const a=60+Math.random()*50,o=Math.random()*Math.PI*2,l=4+Math.random()*55;t[r*3]=Math.cos(o)*a,t[r*3+1]=l,t[r*3+2]=Math.sin(o)*a}const n=new Pt;n.setAttribute("position",new Wt(t,3));const s=new zl({color:10475775,size:.55,transparent:!0,opacity:.75,blending:Hi,depthWrite:!1,sizeAttenuation:!0});this.stars=new Mh(n,s),this.group.add(this.stars)}_buildLights(){this.scene.add(new Rh(2771594,329231,.85));const e=new Lh(12577023,1.1);e.position.set(12,24,10),this.scene.add(e);const t=new Uo(16723349,60,70,1.8);t.position.set(-17,7,-17),this.scene.add(t);const n=new Uo(61695,60,70,1.8);n.position.set(17,7,17),this.scene.add(n)}update(e){this.stars.rotation.y=e*.008,this.centerRing.rotation.z=e*.4;const t=1+Math.sin(e*1.6)*.06;this.centerRing.scale.setScalar(t)}}const Kl={chaser:{color:16724821,glow:16724821,hp:24,speed:3.1,damage:10,score:10,radius:.55,baseY:.75},runner:{color:16723349,glow:16723349,hp:12,speed:5.4,damage:6,score:15,radius:.42,baseY:.62},tank:{color:16752412,glow:16752412,hp:90,speed:1.7,damage:22,score:30,radius:.95,baseY:1}};function qs(i,e,t){return i.add(e,"view",{obj:t}),i.get(e,"transform").pos.y=t.position.y,t}function ol(i,e){const t=i.create();i.add(t,"transform",{pos:new L(0,.55,0),rotY:Math.PI});const n=new _n,s=new ot(new Vs(.42,1.15,4),new vi({color:404019,emissive:61695,emissiveIntensity:1.7,roughness:.3,metalness:.6}));s.rotation.x=Math.PI/2,s.position.y=.1,n.add(s);const r=new ot(new wi(.56,.05,8,32),new nn({color:8385535}));r.rotation.x=Math.PI/2,r.position.y=-.32,n.add(r);const a=Zi(61695,3.2,.6);return n.add(a),n.position.set(0,.55,0),e.add(n),qs(i,t,n),i.add(t,"player",{hp:100,maxHp:100,speed:8,fireInterval:.24,damage:12,fireCd:0,dashCd:0,dashT:0,invuln:0,radius:.6,aim:new L(0,0,-6),moveX:0,moveZ:0,hull:s,glow:a}),t}function km(i,e,t,n,s,r){const a=Kl[t],o=i.create(),l=new L(n,a.baseY,s);i.add(o,"transform",{pos:l,rotY:Math.random()*Math.PI*2});const c=new _n;let h;t==="chaser"?h=new Gs(.55):t==="runner"?h=new xi(.5):h=new Wa(.95);const u=new vi({color:657940,emissive:a.color,emissiveIntensity:1.35,roughness:.35,metalness:.4}),d=new ot(h,u);if(c.add(d),t==="tank"){const m=new ot(h,new nn({color:16769187,wireframe:!0,transparent:!0,opacity:.3}));m.scale.setScalar(1.12),c.add(m)}const p=Zi(a.glow,t==="tank"?3.4:2.3,.55);c.add(p),c.position.copy(l),e.add(c),qs(i,o,c);const _=1+.13*(r-1),M=Math.min(a.speed+(t==="runner"?.22:t==="tank"?.09:.16)*r,a.speed*1.9);return i.add(o,"enemy",{kind:t,hp:Math.round(a.hp*_),maxHp:Math.round(a.hp*_),speed:M,damage:a.damage,radius:a.radius,score:a.score,baseY:a.baseY,touchCd:0,spawnT:0,flash:0,bobPhase:Math.random()*Math.PI*2,spin:(t==="runner"?3.2:t==="tank"?.7:1.6)*(Math.random()>.5?1:-1),body:d,mat:u,glow:p}),o}function Vm(i,e,t,n,s){const r=i.create(),a=t.clone();a.y=.62,i.add(r,"transform",{pos:a,rotY:0});const o=new _n,l=new ot(new yn(.13,.13,.95),new nn({color:13237247}));o.add(l);const c=Zi(61695,1.5,.8);o.add(c),o.position.copy(a),o.lookAt(a.clone().add(n)),e.add(o),qs(i,r,o);const h=n.clone().setY(0).normalize().multiplyScalar(34);return i.add(r,"bullet",{vel:h,life:1.15,damage:s,radius:.35}),r}function ws(i,e,t,n,s){const r=i.create(),a=new L(n,.55,s);i.add(r,"transform",{pos:a,rotY:0});const o=t==="heal"?3669940:16765286,l=new _n,c=t==="heal"?new Xa(.32):new Gs(.3),h=new ot(c,new vi({color:657940,emissive:o,emissiveIntensity:1.8,roughness:.3,metalness:.4}));return l.add(h),l.add(Zi(o,1.7,.7)),l.position.copy(a),e.add(l),qs(i,r,l),i.add(r,"pickup",{kind:t,life:12,radius:.55,bobPhase:Math.random()*6,body:h}),r}const Gm=420;function Hm(i){return i.query("particle").length}function $n(i,e,t,n,s,r,a,o={}){if(Hm(i)>=Gm)return null;const l=i.create();i.add(l,"transform",{pos:n.clone(),rotY:Math.random()*6});const c=new nn({color:r,transparent:!0,opacity:o.opacity??1,blending:o.additive?Hi:Yn,depthWrite:!1}),h=new ot(Bm(t),c);return h.position.copy(n),t==="ring"&&(h.rotation.x=-Math.PI/2),t==="ghost"&&(h.rotation.x=Math.PI/2),h.scale.setScalar(o.scale??1),e.add(h),i.add(l,"view",{obj:h}),i.add(l,"particle",{vel:s.clone(),angVel:t==="ring"||t==="ghost"?new L:new L((Math.random()-.5)*8,(Math.random()-.5)*8,(Math.random()-.5)*8),life:a,maxLife:a,gravity:o.gravity??-16,shrink:o.shrink??!0,grow:o.grow??0,mat:c,kind:t}),l}function Ra(i,e,t,n,s=!1){const r=s?12:8;for(let a=0;a<r;a++){const o=a/r*Math.PI*2+Math.random()*.5,l=3.5+Math.random()*4.5,c=new L(Math.cos(o)*l,2.5+Math.random()*4,Math.sin(o)*l);$n(i,e,s&&a%2?"shardBig":"shard",t,c,n,.8+Math.random()*.35)}for(let a=0;a<5;a++){const o=new L((Math.random()-.5)*10,Math.random()*6,(Math.random()-.5)*10);$n(i,e,"spark",t,o,16777215,.3+Math.random()*.2,{additive:!0,gravity:-6})}$n(i,e,"ring",new L(t.x,.08,t.z),new L,n,.45,{additive:!0,gravity:0,shrink:!1,grow:s?14:9})}function Wm(i,e,t,n){for(let s=0;s<4;s++){const r=new L((Math.random()-.5)*7,Math.random()*5,(Math.random()-.5)*7);$n(i,e,"spark",t,r,n,.22+Math.random()*.15,{additive:!0,gravity:-8})}}function Xm(i,e,t,n,s){$n(i,e,"ring",new L(t,.08,n),new L,s,.55,{additive:!0,gravity:0,shrink:!1,grow:7});for(let r=0;r<4;r++){const a=Math.random()*Math.PI*2,o=new L(Math.cos(a)*1.5,3+Math.random()*2,Math.sin(a)*1.5);$n(i,e,"spark",new L(t,.2,n),o,s,.4,{additive:!0,gravity:-2})}}function qm(i,e,t,n){const s=$n(i,e,"ghost",t,new L,61695,.3,{additive:!0,gravity:0,opacity:.4,shrink:!1});if(s!=null){const r=i.get(s,"view").obj;r.rotation.set(Math.PI/2,0,0),r.rotateY(n)}}function Ym(i,e,t){Ra(i,e,t,61695,!0),Ra(i,e,t,16777215,!1)}function jl(i,e=.8){const t=Ai-e;i.x=Math.max(-t,Math.min(t,i.x)),i.z=Math.max(-t,Math.min(t,i.z))}const $m=26,ll=.18,Km=2.4;class jm{constructor(e){this.ecs=e,this.game=Mt.getInstance(),this._dir=new L,this._muzzle=new L}update(e){const t=this.game;if(t.world.director.state!=="playing")return;const n=this.ecs.query("player","transform");if(!n.length)return;const s=n[0],r=this.ecs.get(s,"player"),a=this.ecs.get(s,"transform"),o=t.keyboard,l=t.pointer;let c=0,h=0;(o.isDown("KeyW")||o.isDown("ArrowUp"))&&(h-=1),(o.isDown("KeyS")||o.isDown("ArrowDown"))&&(h+=1),(o.isDown("KeyA")||o.isDown("ArrowLeft"))&&(c-=1),(o.isDown("KeyD")||o.isDown("ArrowRight"))&&(c+=1),c+=l.stickVec.x,h+=l.stickVec.y;const u=Math.hypot(c,h);u>1&&(c/=u,h/=u),r.moveX=c,r.moveZ=h,r.dashCd=Math.max(0,r.dashCd-e),r.dashT=Math.max(0,r.dashT-e),(o.consumePress("Space")||l.consumeTouchDash())&&r.dashCd<=0&&u>.01&&(r.dashT=ll,r.dashCd=Km,r.invuln=Math.max(r.invuln,ll+.08),t.audioManager.playPositional("dash",a.pos,{volume:.8}),t.world.director.addTrauma(.12)),r.dashT>0&&qm(this.ecs,t.scene,a.pos,a.rotY);const d=r.dashT>0?$m:r.speed;a.pos.x+=c*d*e,a.pos.z+=h*d*e,jl(a.pos,.9);const p=l.updateAim();r.aim.copy(p),this._dir.set(p.x-a.pos.x,0,p.z-a.pos.z);let _=this._dir.length();if(_<1.4){const m=this._nearestEnemy(a.pos);m&&(this._dir.set(m.x-a.pos.x,0,m.z-a.pos.z),_=this._dir.length())}_>.001&&(this._dir.divideScalar(_),a.rotY=Math.atan2(this._dir.x,this._dir.z)),r.fireCd-=e,r.invuln=Math.max(0,r.invuln-e),l.firing&&r.fireCd<=0&&(r.fireCd=r.fireInterval,this._muzzle.copy(a.pos).addScaledVector(this._dir,.9),Vm(this.ecs,t.scene,this._muzzle,this._dir,r.damage),t.audioManager.playPositional("shoot",a.pos,{volume:.5,refDistance:9}),t.world.director.stats.shots++);const M=this.ecs.get(s,"view");if(M){M.obj.rotation.z=-c*.16,M.obj.rotation.x=h*.1;const m=r.invuln>0&&Math.floor(r.invuln*14)%2===0;M.obj.visible=!m}}_nearestEnemy(e){let t=null,n=1e9;for(const s of this.ecs.query("enemy","transform")){if(this.ecs.get(s,"enemy").spawnT<1)continue;const a=this.ecs.get(s,"transform"),o=(a.pos.x-e.x)**2+(a.pos.z-e.z)**2;o<n&&(n=o,t=a.pos)}return t}}class Zm{constructor(e){this.ecs=e,this.game=Mt.getInstance()}update(e){const t=this.game,n=t.world.director,s=n.state==="playing",r=t.time.elapsedTime,a=this.ecs.query("player","transform"),o=a.length?this.ecs.get(a[0],"transform"):null,l=a.length?this.ecs.get(a[0],"player"):null,c=this.ecs.query("enemy","transform").slice();for(const h of c){const u=this.ecs.get(h,"enemy"),d=this.ecs.get(h,"transform"),p=this.ecs.get(h,"view");if(!u||!d)continue;if(u.spawnT<1){u.spawnT=Math.min(1,u.spawnT+e/.45);const b=u.spawnT*u.spawnT*(3-2*u.spawnT);d.pos.y=u.baseY*b-1.3*(1-b),p&&p.obj.scale.setScalar(Math.max(.05,b));continue}if(d.pos.y=u.baseY+Math.sin(r*3+u.bobPhase)*.12,d.rotY+=u.spin*e,p&&(p.obj.rotation.x+=u.spin*.6*e,u.flash>0&&(u.flash=Math.max(0,u.flash-e*5),u.mat.emissiveIntensity=1.35+u.flash*3.2)),!s||!o)continue;const _=o.pos.x-d.pos.x,M=o.pos.z-d.pos.z,m=Math.hypot(_,M)||.001;let f=_/m*u.speed,y=M/m*u.speed;for(const b of c){if(b===h)continue;const E=this.ecs.get(b,"transform"),w=this.ecs.get(b,"enemy");if(!E||!w||w.spawnT<1)continue;const A=d.pos.x-E.pos.x,R=d.pos.z-E.pos.z,I=Math.hypot(A,R),x=u.radius+w.radius+.25;if(I>.001&&I<x){const S=(x-I)*3.2;f+=A/I*S,y+=R/I*S}}d.pos.x+=f*e,d.pos.z+=y*e,jl(d.pos,u.radius+.3),u.touchCd=Math.max(0,u.touchCd-e),m<u.radius+l.radius+.15&&u.touchCd<=0&&(u.touchCd=.85,n.damagePlayer(u.damage,d.pos),d.pos.x-=_/m*1.1,d.pos.z-=M/m*1.1)}}}class Jm{constructor(e){this.ecs=e,this.game=Mt.getInstance()}update(e){const t=this.game,n=t.world.director;if(n.state!=="playing")return;const s=this.ecs.query("enemy","transform"),r=this.ecs.query("bullet","transform").slice();for(const a of r){const o=this.ecs.get(a,"bullet"),l=this.ecs.get(a,"transform");if(!o||!l)continue;l.pos.addScaledVector(o.vel,e),o.life-=e;let c=o.life<=0||Math.abs(l.pos.x)>Ai||Math.abs(l.pos.z)>Ai;if(!c)for(const h of s){const u=this.ecs.get(h,"enemy"),d=this.ecs.get(h,"transform");if(!u||!d||u.spawnT<.6)continue;const p=d.pos.x-l.pos.x,_=d.pos.z-l.pos.z,M=d.pos.y-l.pos.y,m=u.radius+o.radius;if(p*p+_*_+M*M*.5<m*m){c=!0,u.hp-=o.damage,u.flash=1;const f=l.pos.clone();u.hp<=0?n.onKill(h,u,d.pos):(Wm(this.ecs,t.scene,f,10483455),t.audioManager.playPositional("hit",f,{volume:.55}));break}}if(c){const h=this.ecs.get(a,"view");h&&(t.scene.remove(h.obj),Ka(h.obj)),this.ecs.destroy(a)}}}}class Qm{constructor(e){this.ecs=e,this.game=Mt.getInstance()}update(e){const t=this.game,n=t.world.director;if(n.state!=="playing")return;const s=this.ecs.query("player","transform");if(!s.length)return;const r=this.ecs.get(s[0],"transform"),a=t.time.elapsedTime;for(const o of this.ecs.query("pickup","transform").slice()){const l=this.ecs.get(o,"pickup"),c=this.ecs.get(o,"transform");if(!l||!c)continue;l.life-=e,c.pos.y=.55+Math.sin(a*4+l.bobPhase)*.12,c.rotY+=e*2,l.body&&(l.body.rotation.x+=e*1.5);const h=r.pos.x-c.pos.x,u=r.pos.z-c.pos.z,d=Math.hypot(h,u)||.001;if(d<3.4){const M=(3.4-d)*6+2;c.pos.x+=h/d*M*e,c.pos.z+=u/d*M*e}let p=l.life<=0;!p&&d<l.radius+.75&&(p=!0,n.onPickup(l,c.pos));const _=this.ecs.get(o,"view");_&&l.life<3&&(_.obj.visible=Math.floor(l.life*6)%2===0),p&&(_&&(t.scene.remove(_.obj),Ka(_.obj)),this.ecs.destroy(o))}}}class eg{constructor(e){this.ecs=e,this.game=Mt.getInstance()}update(e){const t=this.game.scene;for(const n of this.ecs.query("particle","transform").slice()){const s=this.ecs.get(n,"particle"),r=this.ecs.get(n,"transform"),a=this.ecs.get(n,"view");if(!s||!r)continue;if(s.life-=e,s.life<=0){a&&(t.remove(a.obj),s.mat.dispose()),this.ecs.destroy(n);continue}s.vel.y+=s.gravity*e,r.pos.addScaledVector(s.vel,e),r.pos.y<.06&&s.kind==="shard"&&(r.pos.y=.06,s.vel.y=Math.abs(s.vel.y)*.35,s.vel.x*=.7,s.vel.z*=.7);const o=s.life/s.maxLife;if(s.mat.opacity=o,a&&(a.obj.position.copy(r.pos),a.obj.rotation.x+=s.angVel.x*e,a.obj.rotation.y+=s.angVel.y*e,a.obj.rotation.z+=s.angVel.z*e,s.shrink&&a.obj.scale.setScalar(Math.max(.01,o)),s.grow)){const l=1+(1-o)*s.grow;a.obj.scale.setScalar(l)}}}}const cl="void-survivor-best";class tg{constructor(e){this.ecs=e,this.game=Mt.getInstance(),this.state="title",this.wave=0,this.spawnQueue=[],this.spawnTimer=0,this.trauma=0,this.stats={score:0,kills:0,shots:0},this.best=this._loadBest(),this._memBest=this.best,this.upgradeChoices=[],this._v=new L}_loadBest(){try{const e=localStorage.getItem(cl);if(e!=null)return Number(e)||0}catch{}try{if(window.PipySDK&&window.PipySDK.load){const e=window.PipySDK.load("best");if(typeof e=="number")return e}}catch{}return 0}_saveBest(e){this._memBest=e;try{localStorage.setItem(cl,String(e))}catch{}try{window.PipySDK&&window.PipySDK.save&&window.PipySDK.save("best",e)}catch{}}startRun(){const e=this.game;e.world.resetEntities(),this.state="playing",this.wave=0,this.trauma=0,this.stats={score:0,kills:0,shots:0},e.ui.hideTitle(),e.ui.hideGameOver(),e.ui.hideUpgrade(),e.ui.showHUD(),this.startNextWave()}startNextWave(){this.wave++;const e=this.wave,t=Math.min(4+3*e,34);this.spawnQueue=[];for(let n=0;n<t;n++){let s="chaser";const r=Math.random();e>=3&&r<.12+e*.015?s="tank":e>=2&&r<.45&&(s="runner"),this.spawnQueue.push(s)}this.spawnQueue.sort((n,s)=>(n==="tank"?1:0)-(s==="tank"?1:0)),this.spawnTimer=1.1,this.state="playing",this.game.ui.banner(`${this.t("WAVE")} ${e}`,this.t("Survive!")),this.game.audioManager.play("wave","sfx",{volume:.8})}t(e){return window.I18N?window.I18N.t(e):e}update(e){if(this.trauma=Math.max(0,this.trauma-e*1.5),this.state==="playing"){if(this.spawnQueue.length){if(this.spawnTimer-=e,this.spawnTimer<=0){const t=this.spawnQueue.shift();this._spawnAtEdge(t),this.spawnTimer=Math.max(.32,1-this.wave*.05)}}else if(this.ecs.query("enemy").length===0){const t=50*this.wave;this.stats.score+=t,this.state="upgrade",this.game.audioManager.play("upgrade","sfx",{volume:.7}),this.upgradeChoices=this._rollUpgrades(),this.game.ui.showUpgrade(this.upgradeChoices,this.wave,t)}}}_spawnAtEdge(e){const t=Kl[e],n=Ai-2.2;let s,r;const a=this.ecs.query("player","transform")[0],o=a!=null?this.ecs.get(a,"transform").pos:null;for(let l=0;l<8;l++){const c=Math.floor(Math.random()*4),h=(Math.random()*2-1)*n;if(c===0?(s=h,r=-n):c===1?(s=h,r=n):c===2?(s=-n,r=h):(s=n,r=h),!o||Math.hypot(s-o.x,r-o.z)>8)break}km(this.ecs,this.game.scene,e,s,r,this.wave),Xm(this.ecs,this.game.scene,s,r,t.color),this.game.audioManager.playPositional("spawn",this._v.set(s,.5,r),{volume:.5})}onKill(e,t,n){const s=this.game;this.stats.kills++,this.stats.score+=t.score,Ra(this.ecs,s.scene,n,t.kind==="tank"?16752412:t.kind==="runner"?16723349:16724821,t.kind==="tank"),s.audioManager.playPositional("kill",n,{volume:t.kind==="tank"?1:.8}),this.addTrauma(t.kind==="tank"?.28:.1),s.ui.popup(n,`+${t.score}`,"#ffd166");const r=Math.random();t.kind==="tank"?(ws(this.ecs,s.scene,"gem",n.x,n.z),r<.35&&ws(this.ecs,s.scene,"heal",n.x+.8,n.z+.4)):r<.15?ws(this.ecs,s.scene,"heal",n.x,n.z):r<.38&&ws(this.ecs,s.scene,"gem",n.x,n.z);const a=this.ecs.get(e,"view");a&&(s.scene.remove(a.obj),a.obj.traverse(o=>{o.isMesh&&o.geometry&&o.geometry.dispose(),o.material&&o.material.dispose()})),this.ecs.destroy(e)}onPickup(e,t){const n=this.game,s=this.ecs.query("player")[0];if(e.kind==="heal"){if(s!=null){const r=this.ecs.get(s,"player"),a=Math.min(r.maxHp-r.hp,45);r.hp+=a,n.ui.popup(t,`+${Math.round(a)} HP`,"#37ffb4"),n.ui.flash("heal")}n.audioManager.playPositional("heal",t,{volume:.8})}else this.stats.score+=25,n.ui.popup(t,"+25","#ffd166"),n.audioManager.playPositional("pickup",t,{volume:.7})}damagePlayer(e,t){if(this.state!=="playing")return;const n=this.ecs.query("player","transform")[0];if(n==null)return;const s=this.ecs.get(n,"player"),r=this.ecs.get(n,"transform");s.invuln>0||(s.hp-=e,s.invuln=.6,this.addTrauma(.5),this.game.ui.flash("hurt"),this.game.audioManager.playPositional("hurt",r.pos,{volume:.9}),s.hp<=0&&(s.hp=0,this.gameOver(r.pos)))}gameOver(e){this.state="gameover";const t=this.game;Ym(this.ecs,t.scene,e);const n=this.ecs.get(this.ecs.query("player","view")[0],"view");n&&(n.obj.visible=!1),this.addTrauma(.9),t.audioManager.play("gameover","sfx",{volume:.9});const s=this.wave-1,r=this.stats.score>this.best;r&&(this.best=this.stats.score,this._saveBest(this.best));try{window.PipySDK&&window.PipySDK.gameOver({score:this.stats.score,wave:this.wave,kills:this.stats.kills})}catch{}t.ui.showGameOver({waves:s,kills:this.stats.kills,score:this.stats.score,best:this.best,isNewBest:r})}_rollUpgrades(){const e=this.ecs.query("player")[0];e!=null&&this.ecs.get(e,"player");const t=[{id:"rapid",icon:"⚡",name:"FIRE RATE",desc:"+28% fire rate"},{id:"power",icon:"✹",name:"DAMAGE",desc:"+30% damage"},{id:"swift",icon:"➤",name:"MOVE SPEED",desc:"+15% move speed"},{id:"repair",icon:"✚",name:"REPAIR",desc:"+45 HP, +10 max HP"}];for(let n=t.length-1;n>0;n--){const s=Math.floor(Math.random()*(n+1));[t[n],t[s]]=[t[s],t[n]]}return t.slice(0,3).map(n=>({...n}))}chooseUpgrade(e){if(this.state!=="upgrade")return;const t=this.upgradeChoices[e];if(!t)return;const n=this.ecs.query("player")[0];if(n!=null){const s=this.ecs.get(n,"player");t.id==="rapid"?s.fireInterval=Math.max(.07,s.fireInterval*.72):t.id==="power"?s.damage*=1.3:t.id==="swift"?s.speed=Math.min(13.5,s.speed*1.15):t.id==="repair"&&(s.maxHp+=10,s.hp=Math.min(s.maxHp,s.hp+45))}this.game.audioManager.play("click","sfx",{volume:.7}),this.game.ui.hideUpgrade(),this.startNextWave()}addTrauma(e){this.trauma=Math.min(1,this.trauma+e)}}class ng{constructor(e){this.ecs=e,this.game=Mt.getInstance(),this._camTarget=new L,this._look=new L,this._shake=new L,this._titleAngle=0}update(e){const t=this.game,n=t.world.director;for(const l of this.ecs.query("transform","view")){const c=this.ecs.get(l,"transform"),h=this.ecs.get(l,"view");!c||!h||(h.obj.position.copy(c.pos),this.ecs.has(l,"particle")||(h.obj.rotation.y=c.rotY))}const s=t.camera.cameraInstance;if(n.state==="title"){this._titleAngle+=e*.12;const l=26;s.position.set(Math.sin(this._titleAngle)*l,20,Math.cos(this._titleAngle)*l),s.lookAt(0,0,0)}else{const l=this.ecs.query("player","transform")[0],c=l!=null?this.ecs.get(l,"transform").pos:this._camTarget.set(0,0,0);this._camTarget.set(c.x,0,c.z);const h=this._camTarget.clone().add(t.camera.offset),u=1-Math.pow(.0015,e);s.position.lerp(h,u);const d=n.trauma;if(d>0){const p=d*d*.85;this._shake.set((Math.random()-.5)*p,(Math.random()-.5)*p*.6,(Math.random()-.5)*p),s.position.add(this._shake)}this._look.set(c.x,.4,c.z),s.lookAt(this._look)}t.audioManager.updateListener(s);const r=this.ecs.query("player")[0],a=r!=null?this.ecs.get(r,"player"):null,o=this.ecs.query("enemy").length+n.spawnQueue.length;t.ui.updateHUD({hp:a?a.hp:0,maxHp:a?a.maxHp:100,wave:n.wave,kills:n.stats.kills,score:n.stats.score,best:Math.max(n.best,n.stats.score),dashFrac:a?1-a.dashCd/2.4:1,enemiesLeft:o,state:n.state})}}class ig{constructor(){this.game=Mt.getInstance(),this.scene=this.game.scene,this.arena=new zm,this.ecs=new Nm,this.director=this.ecs.addSystem(new tg(this.ecs)),this.ecs.addSystem(new jm(this.ecs)),this.ecs.addSystem(new Zm(this.ecs)),this.ecs.addSystem(new Jm(this.ecs)),this.ecs.addSystem(new Qm(this.ecs)),this.ecs.addSystem(new eg(this.ecs)),this.ecs.addSystem(new ng(this.ecs)),this.playerId=ol(this.ecs,this.scene)}resetEntities(){for(const e of this.ecs.query("view").slice()){const t=this.ecs.get(e,"view");t&&(this.scene.remove(t.obj),Ka(t.obj,!this.ecs.has(e,"particle")))}this.ecs.clear(),this.playerId=ol(this.ecs,this.scene)}update(){const e=this.game.time.delta;this.arena.update(this.game.time.elapsedTime),this.ecs.update(e)}}const Ee={BGM:"bgm",AMBIENT:"ambient",NARRATION:"narration",SFX:"sfx"},sg={master:1,[Ee.BGM]:.5,[Ee.AMBIENT]:.6,[Ee.NARRATION]:.8,[Ee.SFX]:1};class Dn{constructor(e){this.resources=e,this.audioContext=null,this.isMuted=!1,this.volumes={...sg},this.activeTracks={[Ee.BGM]:null,[Ee.AMBIENT]:new Map,[Ee.NARRATION]:null,[Ee.SFX]:new Map},this.pauseState={[Ee.BGM]:this._createPauseState(),[Ee.AMBIENT]:new Map,[Ee.NARRATION]:this._createPauseState(),[Ee.SFX]:new Map},this.init()}_createPauseState(){return{isPaused:!1,startTime:0,pauseTime:0,savedId:null,savedLoop:!1}}init(){this.resources.audioContext?this.audioContext=this.resources.audioContext:typeof window<"u"&&(window.AudioContext||window.webkitAudioContext)&&(this.audioContext=new(window.AudioContext||window.webkitAudioContext)),this.audioContext&&this.audioContext.state==="suspended"&&this._setupUserInteractionHandlers()}_setupUserInteractionHandlers(){const e=()=>{this.audioContext.resume(),document.removeEventListener("click",e),document.removeEventListener("keydown",e)};document.addEventListener("click",e),document.addEventListener("keydown",e)}startBGM(){this.audioContext&&this.audioContext.state==="suspended"?this.audioContext.resume().then(()=>{this.play("bgm",Ee.BGM,{loop:!0,fadeIn:2})}):this.play("bgm",Ee.BGM,{loop:!0,fadeIn:2})}playPositional(e,t,n={}){if(!this.audioContext||this.isMuted)return null;const s=this.resources.items[e];if(!s)return console.warn(`Audio asset "${e}" not found`),null;const{volume:r=1,refDistance:a=7,rolloffFactor:o=1.3}=n,l=r*this.volumes.sfx*this.volumes.master,c=this.audioContext.createBufferSource();c.buffer=s;const h=this.audioContext.createGain();h.gain.value=l;const u=this.audioContext.createPanner();u.panningModel="equalpower",u.distanceModel="inverse",u.refDistance=a,u.maxDistance=80,u.rolloffFactor=o,u.positionX?(u.positionX.value=t.x,u.positionY.value=t.y||0,u.positionZ.value=t.z):u.setPosition(t.x,t.y||0,t.z),c.connect(h).connect(u).connect(this.audioContext.destination),c.start(0);const d=`${e}_${Date.now()}_${Math.random()}`,p={source:c,gainNode:h,panner:u,id:e,loop:!1};return this.activeTracks.sfx.set(d,p),c.onended=()=>{try{c.disconnect(),h.disconnect(),u.disconnect()}catch{}this.activeTracks.sfx.delete(d),this.pauseState.sfx.delete(d)},{...p,sfxId:d}}updateListener(e){if(!this.audioContext)return;const t=this.audioContext.listener,n=e.position;if(t.positionX){t.positionX.value=n.x,t.positionY.value=n.y,t.positionZ.value=n.z;const s=e.getWorldDirection(Dn._fwd);t.forwardX.value=s.x,t.forwardY.value=s.y,t.forwardZ.value=s.z;const r=Dn._up.set(0,1,0).applyQuaternion(e.quaternion);t.upX.value=r.x,t.upY.value=r.y,t.upZ.value=r.z}else if(t.setPosition){t.setPosition(n.x,n.y,n.z);const s=e.getWorldDirection(Dn._fwd),r=Dn._up.set(0,1,0).applyQuaternion(e.quaternion);t.setOrientation(s.x,s.y,s.z,r.x,r.y,r.z)}}play(e,t=Ee.SFX,n={}){if(!this.audioContext||this.isMuted)return null;const s=this.resources.items[e];if(!s)return console.warn(`Audio asset "${e}" not found`),null;const{loop:r=!1,fadeIn:a=0,volume:o=1,offset:l=0}=n;switch(t){case Ee.BGM:return this._playBGM(e,s,{loop:r,fadeIn:a,volume:o,offset:l});case Ee.AMBIENT:return this._playAmbient(e,s,{loop:r,fadeIn:a,volume:o,offset:l});case Ee.NARRATION:return this._playNarration(e,s,{loop:r,fadeIn:a,volume:o,offset:l});case Ee.SFX:return this._playSFX(e,s,{volume:o,loop:r});default:return console.warn(`Unknown audio category: ${t}`),null}}_playBGM(e,t,{loop:n,fadeIn:s,volume:r,offset:a}){this.activeTracks.bgm&&this._stopTrack(this.activeTracks.bgm);const o=this._createAudioTrack(t,{loop:n,fadeIn:s,volume:r*this.volumes.bgm*this.volumes.master,offset:a});this.activeTracks.bgm={...o,id:e,loop:n};const l=this.pauseState.bgm;return l.savedId=e,l.savedLoop=n,l.startTime=this.audioContext.currentTime-a,l.isPaused=!1,this.activeTracks.bgm}_playAmbient(e,t,{loop:n,fadeIn:s,volume:r,offset:a}){const o=r*this.volumes.ambient*this.volumes.master,l=this._createAudioTrack(t,{loop:n,fadeIn:s,volume:o,offset:a}),c=`${e}_${Date.now()}_${Math.random()}`;this.activeTracks.ambient.set(c,{...l,id:e,loop:n});const h=this._createPauseState();return h.savedId=e,h.savedLoop=n,h.savedVolume=o,h.startTime=this.audioContext.currentTime-a,this.pauseState.ambient.set(c,h),n||(l.source.onended=()=>{this._stopTrack(l),this.activeTracks.ambient.delete(c),this.pauseState.ambient.delete(c)}),{...l,ambientId:c}}_playNarration(e,t,{loop:n,fadeIn:s,volume:r,offset:a}){this.activeTracks.narration&&this._stopTrack(this.activeTracks.narration);const o=this._createAudioTrack(t,{loop:n,fadeIn:s,volume:r*this.volumes.narration*this.volumes.master,offset:a});this.activeTracks.narration={...o,id:e,loop:n};const l=this.pauseState.narration;return l.savedId=e,l.savedLoop=n,l.startTime=this.audioContext.currentTime-a,l.isPaused=!1,this.activeTracks.narration}_playSFX(e,t,{volume:n,loop:s=!1}){const r=n*this.volumes.sfx*this.volumes.master,a=this._createAudioTrack(t,{loop:s,fadeIn:0,volume:r,offset:0}),o=`${e}_${Date.now()}_${Math.random()}`;this.activeTracks.sfx.set(o,{...a,id:e,loop:s});const l=this._createPauseState();return l.savedId=e,l.savedLoop=s,l.savedVolume=r,l.startTime=this.audioContext.currentTime,this.pauseState.sfx.set(o,l),s||(a.source.onended=()=>{this._stopTrack(a),this.activeTracks.sfx.delete(o),this.pauseState.sfx.delete(o)}),{...a,sfxId:o}}_createAudioTrack(e,{loop:t,fadeIn:n,volume:s,offset:r}){const a=this.audioContext.createBufferSource(),o=this.audioContext.createGain();return a.buffer=e,a.loop=t,n>0?(o.gain.setValueAtTime(0,this.audioContext.currentTime),o.gain.linearRampToValueAtTime(s,this.audioContext.currentTime+n)):o.gain.value=s,a.connect(o),o.connect(this.audioContext.destination),a.start(0,r),{source:a,gainNode:o}}_stopTrack(e,t=0){if(!e)return;const{source:n,gainNode:s}=e,r=e.panner?[e.panner]:[],a=this.audioContext.currentTime;if(t>0)s.gain.cancelScheduledValues(a),s.gain.setValueAtTime(s.gain.value,a),s.gain.linearRampToValueAtTime(0,a+t),setTimeout(()=>{try{n.stop(),n.disconnect(),s.disconnect(),r.forEach(o=>o.disconnect())}catch{}},t*1e3);else try{n.stop(),n.disconnect(),s.disconnect(),r.forEach(o=>o.disconnect())}catch{}}stop(e,t=1,n=null){switch(e){case Ee.BGM:this.activeTracks.bgm&&(this._stopTrack(this.activeTracks.bgm,t),this.activeTracks.bgm=null,this.pauseState.bgm.isPaused=!1,this.pauseState.bgm.savedId=null);break;case Ee.AMBIENT:if(n){const s=this.activeTracks.ambient.get(n);s&&(this._stopTrack(s,t),this.activeTracks.ambient.delete(n),this.pauseState.ambient.delete(n))}else this.activeTracks.ambient.forEach(s=>{this._stopTrack(s,t)}),this.activeTracks.ambient.clear(),this.pauseState.ambient.clear();break;case Ee.NARRATION:this.activeTracks.narration&&(this._stopTrack(this.activeTracks.narration,t),this.activeTracks.narration=null,this.pauseState.narration.isPaused=!1,this.pauseState.narration.savedId=null);break;case Ee.SFX:if(n){const s=this.activeTracks.sfx.get(n);s&&(this._stopTrack(s,0),this.activeTracks.sfx.delete(n),this.pauseState.sfx.delete(n))}else this.activeTracks.sfx.forEach(s=>{this._stopTrack(s,0)}),this.activeTracks.sfx.clear(),this.pauseState.sfx.clear();break;default:console.warn(`Unknown audio category: ${e}`)}}stopBGM(e=1){this.stop(Ee.BGM,e)}playBGM(e,t=!0,n=1,s=0){return this.play(e,Ee.BGM,{loop:t,fadeIn:n,offset:s})}playSFX(e,t=1){return this.play(e,Ee.SFX,{volume:t})}pause(e,t=null){if(e===Ee.AMBIENT){this._pauseAmbient(t);return}if(e===Ee.SFX){this._pauseSFX(t);return}const n=this.pauseState[e],s=this.activeTracks[e];!s||n.isPaused||(n.pauseTime=this.audioContext.currentTime-n.startTime,this._stopTrack(s,0),n.isPaused=!0)}resume(e,t=null){if(e===Ee.AMBIENT){this._resumeAmbient(t);return}if(e===Ee.SFX){this._resumeSFX(t);return}const n=this.pauseState[e];if(!n.isPaused||!n.savedId)return;const s=this.resources.items[n.savedId];if(!s)return;let r=n.pauseTime;n.savedLoop&&s.duration>0&&(r=r%s.duration),this.play(n.savedId,e,{loop:n.savedLoop,fadeIn:.3,offset:r})}_pauseAmbient(e=null){if(e){const t=this.activeTracks.ambient.get(e);if(!t)return;const n=this.pauseState.ambient.get(e);if(n?.isPaused)return;const s=n||this._createPauseState();s.pauseTime=this.audioContext.currentTime-s.startTime,s.isPaused=!0,t.source.disconnect(),t.gainNode.disconnect(),this.pauseState.ambient.set(e,s)}else this.activeTracks.ambient.forEach((t,n)=>{this._pauseAmbient(n)})}_resumeAmbient(e=null){if(e){const t=this.pauseState.ambient.get(e);if(!t?.isPaused||!t.savedId)return;const n=this.resources.items[t.savedId];if(!n)return;let s=t.pauseTime;t.savedLoop&&n.duration>0&&(s=s%n.duration);const r=this._createAudioTrack(n,{loop:t.savedLoop,fadeIn:.1,volume:t.savedVolume||this.volumes.ambient*this.volumes.master,offset:s});this.activeTracks.ambient.set(e,{...r,id:t.savedId}),t.startTime=this.audioContext.currentTime-s,t.isPaused=!1,t.savedLoop||(r.source.onended=()=>{this._stopTrack(r),this.activeTracks.ambient.delete(e),this.pauseState.ambient.delete(e)})}else this.pauseState.ambient.forEach((t,n)=>{t.isPaused&&this._resumeAmbient(n)})}_pauseSFX(e=null){if(e){const t=this.activeTracks.sfx.get(e);if(!t)return;const n=this.pauseState.sfx.get(e);if(n?.isPaused)return;const s=n||this._createPauseState();s.pauseTime=this.audioContext.currentTime-s.startTime,s.isPaused=!0,t.source.disconnect(),t.gainNode.disconnect(),this.pauseState.sfx.set(e,s)}else this.activeTracks.sfx.forEach((t,n)=>{this._pauseSFX(n)})}_resumeSFX(e=null){if(e){const t=this.pauseState.sfx.get(e);if(!t?.isPaused||!t.savedId)return;const n=this.resources.items[t.savedId];if(!n)return;let s=t.pauseTime;t.savedLoop&&n.duration>0&&(s=s%n.duration);const r=this._createAudioTrack(n,{loop:t.savedLoop,fadeIn:.1,volume:t.savedVolume||this.volumes.sfx*this.volumes.master,offset:s});this.activeTracks.sfx.set(e,{...r,id:t.savedId}),t.startTime=this.audioContext.currentTime-s,t.isPaused=!1,t.savedLoop||(r.source.onended=()=>{this._stopTrack(r),this.activeTracks.sfx.delete(e),this.pauseState.sfx.delete(e)})}else this.pauseState.sfx.forEach((t,n)=>{t.isPaused&&this._resumeSFX(n)})}pauseBGM(){this.pause(Ee.BGM)}resumeBGM(){this.resume(Ee.BGM)}setVolume(e,t){const n=Math.max(0,Math.min(1,t));e==="master"?(this.volumes.master=n,this._updateActiveVolumes()):this.volumes.hasOwnProperty(e)?(this.volumes[e]=n,this._updateCategoryVolume(e)):console.warn(`Unknown volume category: ${e}`)}getVolume(e){return this.volumes[e]??0}_updateActiveVolumes(){this._updateCategoryVolume(Ee.BGM),this._updateCategoryVolume(Ee.AMBIENT),this._updateCategoryVolume(Ee.NARRATION),this._updateCategoryVolume(Ee.SFX)}_updateCategoryVolume(e){if(e===Ee.AMBIENT){const s=this.volumes.ambient,r=this.volumes.master;this.activeTracks.ambient.forEach((a,o)=>{const l=this.pauseState.ambient.get(o);a&&!l?.isPaused&&(a.gainNode.gain.value=s*r)});return}if(e===Ee.SFX){const s=this.volumes.sfx,r=this.volumes.master;this.activeTracks.sfx.forEach((a,o)=>{const l=this.pauseState.sfx.get(o);a&&!l?.isPaused&&(a.gainNode.gain.value=s*r)});return}const t=this.activeTracks[e],n=this.pauseState[e];if(t&&!n?.isPaused){const s=this.volumes[e],r=this.volumes.master;t.gainNode.gain.value=s*r}}setMasterVolume(e){this.setVolume("master",e)}setBGMVolume(e){this.setVolume(Ee.BGM,e)}setSFXVolume(e){this.setVolume(Ee.SFX,e)}setAmbientVolume(e){this.setVolume(Ee.AMBIENT,e)}toggleMute(){return this.isMuted=!this.isMuted,this.isMuted?(this.activeTracks.bgm&&!this.pauseState.bgm.isPaused&&this.pause(Ee.BGM),this.activeTracks.narration&&!this.pauseState.narration.isPaused&&this.pause(Ee.NARRATION),this.pause(Ee.AMBIENT),this.pause(Ee.SFX)):(this.pauseState.bgm.isPaused&&this.pauseState.bgm.savedId&&this.resume(Ee.BGM),this.pauseState.narration.isPaused&&this.pauseState.narration.savedId&&this.resume(Ee.NARRATION),this.resume(Ee.AMBIENT),this.resume(Ee.SFX)),this.isMuted}isMutedState(){return this.isMuted}isPlaying(e){if(e===Ee.AMBIENT)return this.activeTracks.ambient.size>0;if(e===Ee.SFX)return this.activeTracks.sfx.size>0;const t=this.activeTracks[e],n=this.pauseState[e];return t!==null&&!n?.isPaused}destroy(){this.stop(Ee.BGM,0),this.stop(Ee.AMBIENT,0),this.stop(Ee.NARRATION,0),this.stop(Ee.SFX,0),this.audioContext&&this.audioContext.close()}}Dn._fwd=new L;Dn._up=new L;class rg extends Xs{constructor(){super(),this.isVisible=!0,this.isActive=!0,this.setupHandlers()}setupHandlers(){this.handleVisibilityChange=this.handleVisibilityChange.bind(this),this.handleBeforeUnload=this.handleBeforeUnload.bind(this),this.handlePageHide=this.handlePageHide.bind(this),typeof document<"u"&&document.addEventListener("visibilitychange",this.handleVisibilityChange),typeof window<"u"&&(window.addEventListener("beforeunload",this.handleBeforeUnload),window.addEventListener("pagehide",this.handlePageHide))}removeHandlers(){typeof document<"u"&&document.removeEventListener("visibilitychange",this.handleVisibilityChange),typeof window<"u"&&(window.removeEventListener("beforeunload",this.handleBeforeUnload),window.removeEventListener("pagehide",this.handlePageHide))}handleVisibilityChange(){const e=document.hidden;this.isVisible=!e,e?(this.isActive=!1,this.trigger("pause")):(this.isActive=!0,this.trigger("resume"))}handleBeforeUnload(){this.isActive=!1,this.trigger("pause"),console.log("pause")}handlePageHide(){this.isActive=!1,this.trigger("pause"),console.log("pause")}destroy(){this.removeHandlers()}}class ag{constructor(){this.down=new Set,this.pressed=new Set,this._onDown=e=>{if(e.repeat)return;["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","KeyR","Enter","Digit1","Digit2","Digit3"].includes(e.code)&&e.preventDefault(),this.down.add(e.code),this.pressed.add(e.code)},this._onUp=e=>{this.down.delete(e.code)},this._onBlur=()=>{this.down.clear()},window.addEventListener("keydown",this._onDown),window.addEventListener("keyup",this._onUp),window.addEventListener("blur",this._onBlur)}isDown(e){return this.down.has(e)}consumePress(e){return this.pressed.has(e)?(this.pressed.delete(e),!0):!1}endFrame(){this.pressed.clear()}destroy(){window.removeEventListener("keydown",this._onDown),window.removeEventListener("keyup",this._onUp),window.removeEventListener("blur",this._onBlur)}}class og{constructor(){this.game=Mt.getInstance(),this.canvas=this.game.canvas,this.ndc=new Pe(0,-.4),this.hasMouse=!1,this.firing=!1,this.aimPoint=new L(0,0,-6),this.stickVec={x:0,y:0},this.stickId=null,this.aimTouchId=null,this.touchDash=!1,this._raycaster=new Ih,this._plane=new Cn(new L(0,1,0),0),this._hit=new L,this._onMove=e=>{const t=this.canvas.getBoundingClientRect();this.ndc.set((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1),this.hasMouse=!0},this._onDown=e=>{e.pointerType!=="touch"&&e.button===0&&(this._onMove(e),this.firing=!0)},this._onUp=e=>{e.pointerType!=="touch"&&e.button===0&&(this.firing=!1)},this._onLeave=()=>{this.firing=!1},this._onCtx=e=>e.preventDefault(),this.canvas.addEventListener("pointermove",this._onMove),this.canvas.addEventListener("pointerdown",this._onDown),window.addEventListener("pointerup",this._onUp),this.canvas.addEventListener("pointerleave",this._onLeave),this.canvas.addEventListener("contextmenu",this._onCtx),this._setupTouch()}_setupTouch(){this.isTouchDevice="ontouchstart"in window||navigator.maxTouchPoints>0;const e=document.getElementById("vs-stick"),t=document.getElementById("vs-stick-nub"),n=document.getElementById("vs-touch-dash");if(!e||!t||!n)return;const s=()=>{const o=e.getBoundingClientRect();return{x:o.left+o.width/2,y:o.top+o.height/2,rad:o.width/2}};e.addEventListener("pointerdown",o=>{o.preventDefault(),this.stickId=o.pointerId,e.setPointerCapture(o.pointerId),this._stickMove(o,s(),t)}),e.addEventListener("pointermove",o=>{o.pointerId===this.stickId&&this._stickMove(o,s(),t)});const r=o=>{o.pointerId===this.stickId&&(this.stickId=null,this.stickVec.x=0,this.stickVec.y=0,t.style.transform="translate(-50%, -50%)")};e.addEventListener("pointerup",r),e.addEventListener("pointercancel",r),n.addEventListener("pointerdown",o=>{o.preventDefault(),this.touchDash=!0}),this.canvas.addEventListener("pointerdown",o=>{if(o.pointerType!=="touch")return;const l=this.canvas.getBoundingClientRect();o.clientX-l.left<l.width*.45||(this.aimTouchId=o.pointerId,this._touchAim(o,l),this.firing=!0)}),this.canvas.addEventListener("pointermove",o=>{o.pointerType!=="touch"||o.pointerId!==this.aimTouchId||this._touchAim(o,this.canvas.getBoundingClientRect())});const a=o=>{o.pointerType!=="touch"||o.pointerId!==this.aimTouchId||(this.aimTouchId=null,this.firing=!1)};this.canvas.addEventListener("pointerup",a),this.canvas.addEventListener("pointercancel",a)}_stickMove(e,t,n){let s=(e.clientX-t.x)/t.rad,r=(e.clientY-t.y)/t.rad;const a=Math.hypot(s,r);a>1&&(s/=a,r/=a),this.stickVec.x=s,this.stickVec.y=r,n.style.transform=`translate(calc(-50% + ${s*34}px), calc(-50% + ${r*34}px))`}_touchAim(e,t){this.ndc.set((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1),this.hasMouse=!0}updateAim(){const e=this.game.camera.cameraInstance;return this._raycaster.setFromCamera(this.ndc,e),this._raycaster.ray.intersectPlane(this._plane,this._hit)&&this.aimPoint.copy(this._hit),this.aimPoint}consumeTouchDash(){const e=this.touchDash;return this.touchDash=!1,e}destroy(){this.canvas.removeEventListener("pointermove",this._onMove),this.canvas.removeEventListener("pointerdown",this._onDown),window.removeEventListener("pointerup",this._onUp),this.canvas.removeEventListener("pointerleave",this._onLeave),this.canvas.removeEventListener("contextmenu",this._onCtx)}}class lg{constructor(e){this.game=e,this.el={hud:document.getElementById("vs-hud"),hpFill:document.getElementById("vs-hp-fill"),hpNum:document.getElementById("vs-hp-num"),dashFill:document.getElementById("vs-dash-fill"),waveNum:document.getElementById("vs-wave-num"),enemiesLeft:document.getElementById("vs-enemies-left"),score:document.getElementById("vs-score"),kills:document.getElementById("vs-kills"),best:document.getElementById("vs-best"),banner:document.getElementById("vs-banner"),popups:document.getElementById("vs-popups"),flash:document.getElementById("vs-flash"),title:document.getElementById("vs-title"),titleBest:document.getElementById("vs-title-best"),start:document.getElementById("vs-start"),upgrade:document.getElementById("vs-upgrade"),upgradeTitle:document.getElementById("vs-upgrade-title"),cards:document.getElementById("vs-upgrade-cards"),gameover:document.getElementById("vs-gameover"),goWaves:document.getElementById("vs-go-waves"),goKills:document.getElementById("vs-go-kills"),goScore:document.getElementById("vs-go-score"),goBest:document.getElementById("vs-go-best"),newBest:document.getElementById("vs-newbest"),restart:document.getElementById("vs-restart"),touch:document.getElementById("vs-touch")},this._cache={},this._upgradeCb=null,this._proj=new L,this.el.start.addEventListener("click",()=>this._startGame()),this.el.restart.addEventListener("click",()=>this._restart()),window.addEventListener("keydown",t=>{this.game.world?.director?.state==="upgrade"&&["Digit1","Digit2","Digit3"].includes(t.code)&&this.pickUpgrade(Number(t.code.slice(-1))-1)}),window.addEventListener("langchange",()=>this._refreshLang()),this.el.titleBest.textContent=String(this.game.world?.director?.best??0),("ontouchstart"in window||navigator.maxTouchPoints>0)&&this.el.touch.classList.remove("hidden")}t(e){return window.I18N?window.I18N.t(e):e}_startGame(){const e=this.game;e.audioManager.audioContext?.state==="suspended"&&e.audioManager.audioContext.resume().catch(()=>{}),e.audioManager.startBGM(),e.audioManager.play("click","sfx",{volume:.6}),e.world.director.startRun();try{window.PipySDK&&window.PipySDK.newRun({mode:"waves"})}catch{}}_restart(){this.game.audioManager.play("click","sfx",{volume:.6}),this.game.world.director.startRun()}hideTitle(){this.el.title.classList.add("hidden")}showHUD(){this.el.hud.classList.remove("hidden")}showUpgrade(e,t,n){this.el.upgradeTitle.textContent=`${this.t("WAVE")} ${t} ${this.t("CLEARED")}`,this.el.cards.innerHTML="",e.forEach((s,r)=>{const a=document.createElement("button");a.className="vs-card",a.innerHTML=`<span class="vs-card-key">[${r+1}]</span><span class="vs-card-icon">${s.icon}</span><span class="vs-card-name" data-i18n="${s.name}">${s.name}</span><span class="vs-card-desc" data-i18n="${s.desc}">${s.desc}</span>`,a.addEventListener("click",()=>this.pickUpgrade(r)),this.el.cards.appendChild(a)}),this.el.upgrade.classList.remove("hidden"),window.I18N&&window.I18N.apply()}pickUpgrade(e){this.game.world.director.state==="upgrade"&&this.game.world.director.chooseUpgrade(e)}hideUpgrade(){this.el.upgrade.classList.add("hidden")}showGameOver(e){this.el.goWaves.textContent=String(e.waves),this.el.goKills.textContent=String(e.kills),this.el.goScore.textContent=String(e.score),this.el.goBest.textContent=String(e.best),this.el.newBest.classList.toggle("hidden",!e.isNewBest),this.el.gameover.classList.remove("hidden"),this.el.titleBest.textContent=String(e.best)}hideGameOver(){this.el.gameover.classList.add("hidden")}banner(e,t){const n=this.el.banner;if(n.classList.add("hidden"),n.innerHTML="",n.append(e),t){const s=document.createElement("small");s.textContent=t,n.appendChild(s)}n.offsetWidth,n.classList.remove("hidden"),clearTimeout(this._bannerTimer),this._bannerTimer=setTimeout(()=>n.classList.add("hidden"),2300)}popup(e,t,n){const s=this.game.camera.cameraInstance;if(this._proj.copy(e).project(s),this._proj.z>1)return;const r=(this._proj.x*.5+.5)*window.innerWidth,a=(-this._proj.y*.5+.5)*window.innerHeight,o=document.createElement("div");o.className="vs-popup",o.textContent=t,o.style.left=`${r}px`,o.style.top=`${a}px`,o.style.color=n,this.el.popups.appendChild(o),setTimeout(()=>o.remove(),900)}flash(e){const t=this.el.flash;t.classList.remove("hurt","heal"),t.offsetWidth,t.classList.add(e)}updateHUD(e){const t=this._cache,n=Math.max(0,Math.round(e.hp));(t.hp!==n||t.maxHp!==e.maxHp)&&(t.hp=n,t.maxHp=e.maxHp,this.el.hpFill.style.width=`${n/e.maxHp*100}%`,this.el.hpFill.classList.toggle("low",n/e.maxHp<.3),this.el.hpNum.textContent=String(n)),t.wave!==e.wave&&(t.wave=e.wave,this.el.waveNum.textContent=String(e.wave)),t.kills!==e.kills&&(t.kills=e.kills,this.el.kills.textContent=String(e.kills)),t.score!==e.score&&(t.score=e.score,this.el.score.textContent=String(e.score)),t.best!==e.best&&(t.best=e.best,this.el.best.textContent=String(e.best));const s=Math.round(e.dashFrac*100);t.dash!==s&&(t.dash=s,this.el.dashFill.style.width=`${s}%`),(t.left!==e.enemiesLeft||t.state!==e.state)&&(t.left=e.enemiesLeft,t.state=e.state,this.el.enemiesLeft.textContent=e.state==="playing"?`${this.t("ENEMIES")}: ${e.enemiesLeft}`:"")}_refreshLang(){document.querySelectorAll("[data-i18n]").forEach(n=>{const s=n.getAttribute("data-i18n");n.children.length===0&&(n.textContent=s)}),window.I18N&&window.I18N.apply(),this._cache={};const e=this.game.world.director;e.state==="upgrade"&&this.showUpgrade(e.upgradeChoices,e.wave,0);const t=this.el.enemiesLeft.textContent.split(":").pop().trim();this.el.enemiesLeft.textContent=e.state==="playing"?`${this.t("ENEMIES")}: ${t}`:""}}class Mt{constructor(e,t){if(Mt.instance)return Mt.instance;Mt.instance=this,this.canvas=e,this.resources=t,this.isPaused=!1,this.visibilityManager=new rg,this.audioManager=new Dn(this.resources),this.keyboard=new ag,this.sizes=new Lm,this.time=new Dm,this.scene=new fh,this.camera=new Im,this.renderer=new Um,this.pointer=new og,this.ui=new lg(this),this.world=new ig,this.time.on("animate",()=>{this.update()}),this.sizes.on("resize",()=>{this.resize()}),this.visibilityManager.on("pause",()=>this.pause()),this.visibilityManager.on("resume",()=>this.resume())}static getInstance(){return Mt.instance}resize(){this.camera.resize(),this.renderer.resize()}update(){this.isPaused||(this.world.update(),this.renderer.update(),this.keyboard.endFrame())}pause(){this.isPaused||(this.isPaused=!0,this.time&&this.time.pause(),this.audioManager&&!this.audioManager.isMuted&&this.audioManager.pauseBGM())}resume(){this.isPaused&&(this.isPaused=!1,this.time&&this.time.resume(),this.audioManager&&!this.audioManager.isMuted&&(this.audioManager.audioContext?.state==="suspended"?this.audioManager.audioContext.resume().then(()=>{this.audioManager.resumeBGM()}):this.audioManager.resumeBGM()))}}class cg extends Xs{constructor(e){super(),this.sources=e,this.items={},this.sourceByUrl={},this.sources.forEach(t=>{(Array.isArray(t.path)?t.path:[t.path]).forEach(s=>{typeof s=="string"&&(this.sourceByUrl[s]=t)})}),this.toLoad=this.sources.length,this.loaded=0,this.manager=new Gl,this.manager.onProgress=(t,n,s)=>{const r=this.sourceByUrl[t],a=r?r.id:String(t);this.loaded=n,this.trigger("progress",{id:a,itemsLoaded:n,itemsTotal:s,percent:n/s*100})},this.manager.onLoad=()=>{this.trigger("loaded",{itemsLoaded:this.toLoad,itemsTotal:this.toLoad,percent:100})},this.manager.onError=t=>{const n=this.sourceByUrl[t];this.trigger("error",{id:n?n.id:String(t),url:t,itemsLoaded:this.loaded,itemsTotal:this.toLoad})},this.setLoaders(),this.initLoading(),this.toLoad===0&&setTimeout(()=>this.manager.onLoad(),0)}setLoaders(){this.loaders={},this.loaders.textureLoader=new Ah(this.manager),this.audioContext=null}addBuffer(e,t){this.items[e]=t}initLoading(){for(const e of this.sources){const{type:t,path:n,id:s}=e,r=a=>{this.items[s]=a};switch(t){case"texture":this.loaders.textureLoader.load(n,r,void 0);break;case"audio":this.loadAudio(n,s);break;case"proceduralAudio":this.manager.itemStart(s),setTimeout(()=>this.manager.itemEnd(s),0);break;default:console.warn(`Unknown asset type: ${t}`),this.manager.itemStart(s),setTimeout(()=>this.manager.itemEnd(s),0)}}}loadAudio(e,t){const n=window.AudioContext||window.webkitAudioContext;if(!n){console.warn("AudioContext not available, skipping audio load:",t),this.manager.itemEnd(e);return}const s=this.audioContext||new n;this.manager.itemStart(e),fetch(e).then(r=>{if(!r.ok)throw new Error(`Failed to load audio: ${r.statusText}`);return r.arrayBuffer()}).then(r=>s.decodeAudioData(r)).then(r=>{this.items[t]=r,this.manager.itemEnd(e)}).catch(r=>{console.error(`Error loading audio ${t}:`,r),this.manager.itemError(e)})}}const hg=[{id:"shoot",type:"proceduralAudio"},{id:"hit",type:"proceduralAudio"},{id:"kill",type:"proceduralAudio"},{id:"pickup",type:"proceduralAudio"},{id:"heal",type:"proceduralAudio"},{id:"dash",type:"proceduralAudio"},{id:"hurt",type:"proceduralAudio"},{id:"wave",type:"proceduralAudio"},{id:"upgrade",type:"proceduralAudio"},{id:"gameover",type:"proceduralAudio"},{id:"click",type:"proceduralAudio"},{id:"spawn",type:"proceduralAudio"},{id:"bgm",type:"proceduralAudio"}],Os=44100;function ug(i,e=1){const t=window.OfflineAudioContext||window.webkitOfflineAudioContext;return new t(e,Math.ceil(i*Os),Os)}function dg(i,e){const t=i.createBuffer(1,Math.ceil(e*Os),Os),n=t.getChannelData(0);for(let s=0;s<n.length;s++)n[s]=Math.random()*2-1;return t}function Zl(i,e,t,n,s){i.gain.setValueAtTime(1e-4,e),i.gain.linearRampToValueAtTime(t,e+n),i.gain.exponentialRampToValueAtTime(1e-4,e+n+s)}function ut(i,{type:e="sine",f0:t=440,f1:n,t0:s=0,dur:r=.2,peak:a=.3,attack:o=.004,dest:l}){const c=i.createOscillator(),h=i.createGain();return c.type=e,c.frequency.setValueAtTime(t,s),n!=null&&c.frequency.exponentialRampToValueAtTime(Math.max(1,n),s+r),Zl(h,s,a,o,r),c.connect(h).connect(l||i.destination),c.start(s),c.stop(s+r+o+.05),{osc:c,g:h}}function Zt(i,{t0:e=0,dur:t=.2,peak:n=.3,type:s="lowpass",f0:r=3e3,f1:a,q:o=1,dest:l}){const c=i.createBufferSource();c.buffer=dg(i,t+.1);const h=i.createBiquadFilter();h.type=s,h.Q.value=o,h.frequency.setValueAtTime(r,e),a!=null&&h.frequency.exponentialRampToValueAtTime(Math.max(20,a),e+t);const u=i.createGain();Zl(u,e,n,.003,t),c.connect(h).connect(u).connect(l||i.destination),c.start(e),c.stop(e+t+.1)}async function hl(i,e,t=1){const n=ug(i,t);return e(n),n.startRendering()}const fg={shoot(i){ut(i,{type:"square",f0:920,f1:240,dur:.08,peak:.16}),ut(i,{type:"sine",f0:1800,f1:500,dur:.05,peak:.1}),Zt(i,{dur:.03,peak:.06,type:"highpass",f0:2500})},hit(i){Zt(i,{dur:.07,peak:.22,type:"bandpass",f0:1400,q:1.4}),ut(i,{type:"triangle",f0:340,f1:120,dur:.07,peak:.16})},kill(i){Zt(i,{dur:.28,peak:.34,type:"lowpass",f0:5200,f1:240}),ut(i,{type:"sine",f0:150,f1:42,dur:.26,peak:.34});for(let e=0;e<4;e++)Zt(i,{t0:.02+e*.045,dur:.04,peak:.12,type:"bandpass",f0:2200+e*700,q:2})},pickup(i){ut(i,{type:"sine",f0:660,dur:.07,peak:.2}),ut(i,{type:"sine",f0:990,t0:.06,dur:.08,peak:.2}),ut(i,{type:"sine",f0:1320,t0:.12,dur:.1,peak:.16})},heal(i){ut(i,{type:"sine",f0:520,f1:780,dur:.16,peak:.22}),ut(i,{type:"sine",f0:780,f1:1040,t0:.12,dur:.16,peak:.16})},dash(i){Zt(i,{dur:.2,peak:.2,type:"highpass",f0:500,f1:4200}),ut(i,{type:"sine",f0:220,f1:640,dur:.16,peak:.14})},hurt(i){ut(i,{type:"sawtooth",f0:170,f1:55,dur:.22,peak:.3}),Zt(i,{dur:.16,peak:.22,type:"lowpass",f0:1600,f1:300})},wave(i){ut(i,{type:"sawtooth",f0:220,dur:.3,peak:.16}),ut(i,{type:"sawtooth",f0:330,t0:.14,dur:.34,peak:.16}),ut(i,{type:"sine",f0:110,dur:.4,peak:.22}),Zt(i,{t0:.14,dur:.3,peak:.08,type:"highpass",f0:3e3})},upgrade(i){[523,659,784,1047].forEach((t,n)=>ut(i,{type:"triangle",f0:t,t0:n*.08,dur:.14,peak:.18}))},gameover(i){ut(i,{type:"sawtooth",f0:220,f1:55,dur:.9,peak:.24}),ut(i,{type:"sine",f0:110,f1:30,dur:1,peak:.28}),Zt(i,{t0:.1,dur:.7,peak:.1,type:"lowpass",f0:900,f1:120})},click(i){ut(i,{type:"square",f0:1200,f1:800,dur:.04,peak:.1})},spawn(i){ut(i,{type:"sine",f0:90,f1:240,dur:.18,peak:.12}),Zt(i,{dur:.14,peak:.07,type:"bandpass",f0:900,q:3})}};function pg(i){const t=i.createGain();t.gain.value=.5,t.connect(i.destination);for(let r=0;r<13;r++){const a=r*.6;if(a>=8)break;ut(i,{type:"sine",f0:130,f1:40,t0:a,dur:.16,peak:.5,dest:t})}for(let r=0;r<13;r++){const a=r*.6+.3;if(a>=8)break;Zt(i,{t0:a,dur:.04,peak:.1,type:"highpass",f0:6e3,dest:t})}const n=[55,55,65.4,49];for(let r=0;r<4;r++){const a=r*2*.6,o=n[r%4],l=i.createOscillator();l.type="sawtooth",l.frequency.value=o;const c=i.createBiquadFilter();c.type="lowpass",c.frequency.setValueAtTime(420,a),c.frequency.exponentialRampToValueAtTime(140,a+.6*1.8);const h=i.createGain();h.gain.setValueAtTime(1e-4,a),h.gain.linearRampToValueAtTime(.3,a+.02),h.gain.setValueAtTime(.3,a+.6*1.5),h.gain.exponentialRampToValueAtTime(1e-4,a+.6*1.95),l.connect(c).connect(h).connect(t),l.start(a),l.stop(a+.6*2)}[220,261.6,329.6].forEach((r,a)=>{[-4,4].forEach(o=>{const l=i.createOscillator();l.type="sawtooth",l.frequency.value=r,l.detune.value=o;const c=i.createBiquadFilter();c.type="lowpass",c.frequency.value=700+a*120;const h=i.createGain();h.gain.setValueAtTime(1e-4,0),h.gain.linearRampToValueAtTime(.035,1.2),h.gain.setValueAtTime(.035,6.6),h.gain.linearRampToValueAtTime(1e-4,8),l.connect(c).connect(h).connect(t),l.start(0),l.stop(8)})}),[440,523.25,659.25,880,659.25,523.25].forEach((r,a)=>{const o=.3+a*1.25;o<7.6&&ut(i,{type:"triangle",f0:r,t0:o,dur:.22,peak:.05,dest:t})})}async function mg(){const i={},e=Object.entries(fg).map(async([t,n])=>{const s=t==="gameover"?1.3:t==="wave"?.7:t==="upgrade"?.5:.4;i[t]=await hl(s,n,1)});return e.push((async()=>{i.bgm=await hl(8,pg,2)})()),await Promise.all(e),i}const ja=new cg(hg);let Jl=!1,Ql=!1,ul=!1;function ec(){!Jl||!Ql||ul||(ul=!0,gg())}ja.on("loaded",()=>{Jl=!0,ec()});mg().then(i=>{for(const[e,t]of Object.entries(i))ja.addBuffer(e,t)}).catch(i=>{console.warn("Audio synthesis unavailable, continuing silently:",i)}).finally(()=>{Ql=!0,ec()});function gg(){const i=new Mt(document.getElementById("three"),ja),e=i.world.director,t=i.ui;t.el.titleBest.textContent=String(e.best),window.addEventListener("keydown",n=>{const s=e.state;s==="title"&&(n.code==="Enter"||n.code==="Space")?t._startGame():(s==="gameover"&&(n.code==="KeyR"||n.code==="Enter"||n.code==="Space")||s==="playing"&&n.code==="KeyR")&&t._restart()}),t.el.title.addEventListener("click",n=>{n.target.closest("a")||e.state==="title"&&t._startGame()}),window.__VOID__={game:i,ecs:i.world.ecs,director:e,ui:t,state:()=>e.state,stats:()=>({...e.stats,wave:e.wave,best:e.best}),player:()=>{const n=i.world.ecs.query("player")[0];if(n==null)return null;const s=i.world.ecs.get(n,"player"),r=i.world.ecs.get(n,"transform");return{hp:s.hp,maxHp:s.maxHp,x:r.pos.x,z:r.pos.z,damage:s.damage,fireInterval:s.fireInterval,speed:s.speed}},enemies:()=>i.world.ecs.query("enemy").map(n=>{const s=i.world.ecs.get(n,"enemy"),r=i.world.ecs.get(n,"transform");return{kind:s.kind,hp:s.hp,x:r.pos.x,z:r.pos.z,spawnT:s.spawnT}}),nearestEnemyScreen:()=>{const n=i.world.ecs.query("player","transform")[0];if(n==null)return null;const s=i.world.ecs.get(n,"transform").pos;let r=null,a=1e9;for(const l of i.world.ecs.query("enemy","transform")){const c=i.world.ecs.get(l,"enemy"),h=i.world.ecs.get(l,"transform");if(c.spawnT<1)continue;const u=(h.pos.x-s.x)**2+(h.pos.z-s.z)**2;u<a&&(a=u,r=h.pos)}if(!r)return null;const o=r.clone().project(i.camera.cameraInstance);return{x:(o.x*.5+.5)*window.innerWidth,y:(-o.y*.5+.5)*window.innerHeight,dist:Math.sqrt(a)}}}}
