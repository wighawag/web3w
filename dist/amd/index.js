"use strict";var __awaiter=this&&this.__awaiter||function(e,n,t,o){return new(t||(t=Promise))(function(i,r){function s(e){try{d(o.next(e))}catch(e){r(e)}}function a(e){try{d(o.throw(e))}catch(e){r(e)}}function d(e){var n;e.done?i(e.value):(n=e.value,n instanceof t?n:new t(function(e){e(n)})).then(s,a)}d((o=o.apply(e,n||[])).next())})};define("errors",["require","exports"],function(e,n){Object.defineProperty(n,"__esModule",{value:!0}),n.MODULE_ERROR=n.CHAIN_CONFIG_NOT_AVAILABLE=n.CHAIN_NO_PROVIDER=void 0,n.CHAIN_NO_PROVIDER=6e3,n.CHAIN_CONFIG_NOT_AVAILABLE=6001,n.MODULE_ERROR=1e3}),define("utils/internals",["require","exports"],function(e,n){function t(e,t,o){if(null==e)return n.noop;const i=e.subscribe(t,o);return i.unsubscribe?()=>i.unsubscribe():i}Object.defineProperty(n,"__esModule",{value:!0}),n.get_store_value=n.safe_not_equal=n.subscribe=n.noop=void 0,n.noop=(()=>void 0),n.subscribe=t,n.safe_not_equal=function(e,n){return e!=e?n==n:e!==n||e&&"object"==typeof e||"function"==typeof e},n.get_store_value=function(e){let n;return t(e,e=>n=e)(),n}}),define("utils/store",["require","exports","utils/internals"],function(e,n,t){Object.defineProperty(n,"__esModule",{value:!0}),n.get=n.writable=n.readable=void 0,Object.defineProperty(n,"get",{enumerable:!0,get:function(){return t.get_store_value}});const o=[];function i(e,n=t.noop){let i=null;const r=[];function s(n){if(t.safe_not_equal(e,n)&&(e=n,i)){const n=!o.length;for(let n=0;n<r.length;n+=1){const t=r[n];t[1](),o.push(t,e)}if(n){for(let e=0;e<o.length;e+=2)o[e][0](o[e+1]);o.length=0}}}return{set:s,update:function(n){s(n(e))},subscribe:function(o,a=t.noop){const d=[o,a];return r.push(d),1===r.length&&(i=n(s)||t.noop),o(e),()=>{const e=r.indexOf(d);-1!==e&&r.splice(e,1),0===r.length&&null!==i&&(i(),i=null)}}}}n.readable=function(e,n){return{subscribe:i(e,n).subscribe}},n.writable=i}),define("utils/builtin",["require","exports"],function(e,n){function t(){if("undefined"!=typeof window){const e=window;if(e.ethereum)return e.ethereum;if(e.web3)return e.web3.currentProvider}return null}Object.defineProperty(n,"__esModule",{value:!0}),n.getVendor=n.fetchEthereum=n.getEthereum=void 0,n.getEthereum=t,n.fetchEthereum=function(){return new Promise(e=>{"complete"!==document.readyState?document.onreadystatechange=function(){"complete"===document.readyState&&(document.onreadystatechange=null,e(t()))}:e(t())})},n.getVendor=function(e){return e?e.isMetaMask?"Metamask":-1!=navigator.userAgent.indexOf("Opera")||-1!=navigator.userAgent.indexOf("OPR/")?"Opera":"unknown":void 0}}),define("utils/index",["require","exports"],function(e,n){Object.defineProperty(n,"__esModule",{value:!0}),n.timeout=void 0,n.timeout=function(e,n,t){return new Promise((o,i)=>{let r=!1;const s=setTimeout(()=>{r=!0,t?"function"==typeof t?o(t()):i(t.error||t):i(new Error("TimedOut"))},e);n.then(e=>{r||(clearTimeout(s),o(e))}).catch(e=>{r||(clearTimeout(s),i(e))})})}}),define("utils/ethers",["require","exports","utils/internals"],function(e,n,t){function o(e,n,{onTxRequested:t,onTxCancelled:o,onTxSent:i,onSignatureRequested:r,onSignatureCancelled:s,onSignatureReceived:a}){n=Object.assign({sendTransaction:(e,n,r)=>__awaiter(this,void 0,void 0,function*(){let s;t(r[0]);try{s=yield e.bind(n)(...r)}catch(e){throw o(r[0]),e}return i(s),s}),signMessage:(e,n,t)=>__awaiter(this,void 0,void 0,function*(){let o;r(t[0]);try{o=yield e.bind(n)(...t)}catch(e){throw s(t[0]),e}return a(o),o})},n);const d={};return new Proxy(e,{get:(t,o)=>{const i=n[o];return i?function(n,t){let o=d[n];return o||(o=new Proxy(e[n],t),d[n]=o),o}(o,{apply:i}):t[o]}})}function i(e,n){return o(e,{connectUnchecked:(e,t,i)=>{return function(e,n){return o(e,{},n)}(e.bind(t)(...i),n)}},n)}Object.defineProperty(n,"__esModule",{value:!0}),n.proxyWeb3Provider=n.proxyContract=void 0,n.proxyContract=function(e,n,o){const i=o?Object.assign({onContractTxRequested:t.noop,onContractTxCancelled:t.noop,onContractTxSent:t.noop},o):{onContractTxRequested:t.noop,onContractTxCancelled:t.noop,onContractTxSent:t.noop},{onContractTxRequested:r,onContractTxCancelled:s,onContractTxSent:a}=i,d={},c=e.interface.functions,u={};for(const e of Object.keys(c))u[c[e].name]=e;const l={};for(const n of Object.keys(e))l[n]=e[n];l.functions={};for(const n of Object.keys(e.functions))l.functions[n]=e.functions[n];function f(t,o){let i=d[o];if(!i){let c=e.interface.functions[o];c||(c=e.interface.functions[u[o]]),i=new Proxy(t[o],{apply:(e,i,d)=>__awaiter(this,void 0,void 0,function*(){const i=d.length;let u,l,f;i===c.inputs.length+1&&"object"==typeof d[i-1]&&(u=d[i]),u&&(l=u.outcome,delete u.outcome),r({name:n,method:o,overrides:u,outcome:l});try{f=yield e.bind(t)(...d)}catch(e){throw s({name:n,method:o,overrides:u,outcome:l}),e}return a({hash:f.hash,name:n,method:o,overrides:u,outcome:l}),f})}),d[o]=i}return i}const g=new Proxy(l.functions,{get:(n,t)=>f(e.functions,t)});return new Proxy(l,{get:(n,t)=>"functions"===t?g:e.functions[t]?f(e.functions,t):"_proxiedContract"===t?e:"toJSON"===t?()=>({address:e.address,abi:e.interface.fragments}):n[t]})},n.proxyWeb3Provider=function(e,n){const o=n?Object.assign({onTxRequested:t.noop,onTxCancelled:t.noop,onTxSent:t.noop,onSignatureRequested:t.noop,onSignatureCancelled:t.noop,onSignatureReceived:t.noop},n):{onTxRequested:t.noop,onTxCancelled:t.noop,onTxSent:t.noop,onSignatureRequested:t.noop,onSignatureCancelled:t.noop,onSignatureReceived:t.noop},r=new Proxy(e.getSigner,{apply:(n,t,r)=>i(n.bind(e)(...r),o)});return new Proxy(e,{get:(e,n)=>"getSigner"===n?r:"signMessage"===n?r:"sendTransaction"===n?r:"connectUnchecked"===n?r:e[n]})}}),define("index",["require","exports","@ethersproject/contracts","@ethersproject/providers","utils/store","utils/builtin","utils/index","utils/ethers","named-logs","errors"],function(e,n,t,o,i,r,s,a,d,c){Object.defineProperty(n,"__esModule",{value:!0});const u=d.logs("web3w:index"),l="undefined"!=typeof window,f={state:"Idle",loading:!1,available:void 0,error:void 0,vendor:void 0},g={state:"Idle",loading:!1,stale:void 0,amount:void 0,error:void 0,blockNumber:void 0},v={state:"Idle",loading:!1,contracts:{},error:void 0},b={state:"Idle",loading:!1,unlocking:!1,address:void 0,options:void 0,selected:void 0,pendingUserConfirmation:void 0,error:void 0};function h(e){const n=i.writable(e);return n.data=e,n}const p=[],m=h(b),w=h(p),y=h(f),_=h(v),C=h(g);function x(e,n){for(const t of Object.keys(n)){const o=n,i=e;if(i.data[t]&&"object"==typeof o[t])for(const e of Object.keys(o[t]))i.data[t][e]=o[t][e];else i.data[t]=o[t]}try{u.debug(JSON.stringify(e.data,null,"  "))}catch(n){u.error(n,e.data)}e.set(e.data)}let O,I,R,S,P,T,A;function E(e){u.debug("onChainChanged",{chainId:e})}function k(e){u.debug("onAccountsChanged",{accounts:e})}function q({chainId:e}){u.debug("onConnect",{chainId:e})}function N(e){u.debug("onDisconnect",{error:e})}function j(e){return"string"==typeof e&&e.length>2&&"0x"===e.slice(0,2).toLowerCase()}function L(e){b.pendingUserConfirmation?b.pendingUserConfirmation.push(e):b.pendingUserConfirmation=[e],x(m,{pendingUserConfirmation:b.pendingUserConfirmation})}function M(e){if(b.pendingUserConfirmation){const n=b.pendingUserConfirmation.indexOf(e);n>=0&&(b.pendingUserConfirmation.splice(n,1),0===b.pendingUserConfirmation.length&&(b.pendingUserConfirmation=void 0),x(m,{pendingUserConfirmation:b.pendingUserConfirmation}))}}const U={onTxRequested:e=>{u.debug("onTxRequested",{transaction:e}),L("transaction")},onTxCancelled:e=>{u.debug("onTxCancelled",{transaction:e}),M("transaction")},onTxSent:e=>{u.debug("onTxSent",{transaction:e}),M("transaction")},onSignatureRequested:e=>{u.debug("onSignatureRequested",{message:e}),L("signature")},onSignatureCancelled:e=>{u.debug("onSignatureCancelled",{message:e}),M("signature")},onSignatureReceived:e=>{u.debug("onSignatureReceived",{signature:e}),M("signature")},onContractTxRequested:({name:e,method:n,overrides:t,outcome:o})=>{u.debug("onContractTxRequest",{name:e,method:n,overrides:t,outcome:o})},onContractTxCancelled:({name:e,method:n,overrides:t,outcome:o})=>{u.debug("onContractTxCancelled",{name:e,method:n,overrides:t,outcome:o})},onContractTxSent:({hash:e,name:n,method:t,overrides:o,outcome:i})=>{u.debug("onContractTxSent",{hash:e,name:n,method:t,overrides:o,outcome:i}),e&&function(e){p.push(e),w.set(p)}({hash:e,name:n,method:t,overrides:o,outcome:i})}},D="_web3w_previous_wallet_type";function V(e){localStorage.setItem(D,e)}function W(e){return __awaiter(this,void 0,void 0,function*(){if(void 0===O){const e={code:c.CHAIN_NO_PROVIDER,message:"no provider setup yet"};throw x(_,{error:e,loading:!1,state:"Idle"}),new Error(e.message)}x(_,{loading:!0});const n={},o={};let i={};const{chainId:r}=yield O.getNetwork(),s=String(r);let d=P;if("function"==typeof d&&(d=yield d(s)),d){if(d.chainId){const e=d;if(s!==e.chainId&&s!=(j(u=e.chainId)?""+parseInt(u.slice(2)):u)){const n={code:c.CHAIN_CONFIG_NOT_AVAILABLE,message:`chainConfig only available for ${e.chainId} , not available for ${s}`};throw x(_,{error:n,chainId:s,notSupported:!0,loading:!1,state:"Idle"}),new Error(n.message)}i=e.contracts}else{const e=d,n=e[s]||e[function(e){return j(e)?e:"0x"+parseInt(e).toString(16)}(s)];if(!n){const e={code:c.CHAIN_CONFIG_NOT_AVAILABLE,message:`chainConfig not available for ${s}`};throw x(_,{error:e,chainId:s,notSupported:!0,loading:!1,state:"Idle"}),new Error(e.message)}i=n.contracts}for(const r of Object.keys(i)){const s=i[r];s.abi&&(n[r]=a.proxyContract(new t.Contract(s.address,s.abi,O.getSigner(e)),r,U)),o[r]=s.address}}var u;x(_,{state:"Ready",loading:void 0,chainId:s,addresses:o,contracts:n})})}function F(e,n){return __awaiter(this,void 0,void 0,function*(){!b.selected||"Ready"!==b.state&&"Locked"!==b.state||(yield Y());let t,i=e;if(!i)if(0===A.length)i="builtin";else{if(1!==A.length){const e=`No Wallet Type Specified, choose from ${b.options}`;throw new Error(e)}i=A[0]}if("builtin"==i&&"Ready"===f.state&&!f.available){throw new Error("No Builtin Wallet")}if(x(m,{address:void 0,loading:!0,selected:e,state:"Idle",error:void 0}),O=void 0,I=void 0,"builtin"===i)T=void 0,yield H(),O=R,I=S;else{let t;if("string"==typeof i){if(A)for(const n of A)"string"!=typeof n&&n.id===e&&(t=n)}else e=(t=i).id;if(!t){const n=`no module found ${e}`;throw x(m,{error:{message:n,code:1},selected:void 0,loading:!1}),new Error(n)}try{const{web3Provider:e}=yield t.setup(n);I=e,O=a.proxyWeb3Provider(new o.Web3Provider(I),U),T=t}catch(e){throw"USER_CANCELED"===e.message?x(m,{loading:!1,selected:void 0}):x(m,{error:{code:c.MODULE_ERROR,message:e.message},selected:void 0,loading:!1}),e}}if(!O){const n=`no provider found for wallet type ${e}`;throw x(m,{error:{message:n,code:1},selected:void 0,loading:!1}),new Error(n)}I&&(u.debug("listenning for connection..."),I.on("connect",q),I.on("disconnect",N));try{t="builtin"===e&&"Metamask"===f.vendor?yield s.timeout(2e3,O.listAccounts(),{error:'Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)'}):yield s.timeout(2e4,O.listAccounts())}catch(e){throw x(m,{error:e,selected:void 0,loading:!1}),e}V(e);const r=t&&t[0];r?(x(m,{address:r,state:"Ready",loading:void 0}),function(e){I&&(u.debug("listenning for changes...",{address:e}),I.on("chainChanged",E),I.on("accountsChanged",k))}(r),yield W(r)):x(m,{address:void 0,state:"Locked",loading:void 0})})}let $,B;function H(){return $||($=new Promise((e,n)=>__awaiter(this,void 0,void 0,function*(){if("Ready"===f.state)return e();x(y,{loading:!0});try{const e=yield r.fetchEthereum();e?(S=e,R=a.proxyWeb3Provider(new o.Web3Provider(e),U),x(y,{state:"Ready",vendor:r.getVendor(e),available:!0,loading:void 0})):x(y,{state:"Ready",vendor:void 0,available:!1,loading:void 0})}catch(e){return x(y,{error:e.message||e,vendor:void 0,available:void 0,loading:!1}),n(e)}e()})))}function G(e,n){return __awaiter(this,void 0,void 0,function*(){return yield F(e,n),"Locked"!==b.state||z()})}function J(e){Y()}function Y(){return __awaiter(this,void 0,void 0,function*(){I&&(u.debug("stop listenning for changes..."),I.removeListener("chainChanged",E),I.removeListener("accountsChanged",k)),I&&(u.debug("stop listenning for connection..."),I.removeListener("connect",q),I.removeListener("disconnect",N)),T&&(yield T.logout(),T=void 0),x(m,{state:"Idle",address:void 0,loading:!1,unlocking:void 0,selected:void 0,error:void 0}),x(C,{state:"Idle",amount:void 0,error:void 0,blockNumber:void 0}),x(_,{contracts:void 0,state:"Idle",notSupported:void 0,chainId:void 0,error:void 0}),V("")})}function z(){if(B)return B;let e=!1;const n=new Promise((n,t)=>__awaiter(this,void 0,void 0,function*(){if("Locked"===b.state){let t;x(m,{unlocking:!0});try{t=(t=yield null==O?void 0:O.send("eth_requestAccounts",[]))||[]}catch(e){t=[]}if(!(t.length>0))return x(m,{unlocking:!1}),B=void 0,e=!0,n(!1);{const e=t[0];x(m,{address:e,state:"Ready",unlocking:void 0}),yield W(e)}return B=void 0,e=!0,n(!0)}return e=!0,t(new Error("Not Locked"))}));return e||(B=n),n}n.default=(e=>{(e=Object.assign({},e||{})).builtin=e.builtin||{autoProbe:!1};const{debug:n,chainConfigs:t,builtin:o}=e;if(P=t,n&&"undefined"!=typeof window&&(window.$wallet=b,window.$transactions=p),A=e.options||[],x(m,{state:"Idle",options:A.map(e=>{if("object"==typeof e){if(!e.id)throw new Error("options need to be string or have an id");return e.id}return e})}),x(y,{state:"Idle"}),x(_,{state:"Idle"}),x(C,{state:"Idle"}),l){if(e.autoSelectPrevious){const e=localStorage.getItem(D);e&&""!==e&&F(e)}o.autoProbe&&H()}return{transactions:{subscribe:w.subscribe},balance:{subscribe:C.subscribe},chain:{subscribe:_.subscribe},builtin:{subscribe:y.subscribe,probe:H},wallet:{subscribe:m.subscribe,connect:G,unlock:z,acknowledgeError:J,logout:Y,get address(){return b.address},get provider(){return O},get web3Provider(){return I},get chain(){return v},get contracts(){return v.contracts},get balance(){return g.amount}}}})}),define("utils/web",["require","exports"],function(e,n){Object.defineProperty(n,"__esModule",{value:!0}),n.isPrivateWindow=void 0,n.isPrivateWindow=function(){return new Promise(function(e){if("undefined"!=typeof window)try{if(navigator.vendor&&navigator.vendor.indexOf("Apple")>-1&&navigator.userAgent&&-1==navigator.userAgent.indexOf("CriOS")&&-1==navigator.userAgent.indexOf("FxiOS")){let n=!1;if(window.safariIncognito)n=!0;else try{window.openDatabase(null,null,null,null),window.localStorage.setItem("test",1),e(!1)}catch(t){n=!0,e(!0)}}else if(navigator.userAgent.includes("Firefox")){const n=indexedDB.open("test");n.onerror=function(){e(!0)},n.onsuccess=function(){e(!1)}}else if(navigator.userAgent.includes("Edge")||navigator.userAgent.includes("Trident")||navigator.userAgent.includes("msie"))window.indexedDB||!window.PointerEvent&&!window.MSPointerEvent||e(!0),e(!1);else{(function(){const e=navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);if(null!=e&&5==e.length)return e.map(e=>parseInt(e,10))[1]>=76})()&&e(function(){return __awaiter(this,void 0,void 0,function*(){if("storage"in navigator&&"estimate"in navigator.storage){const{quota:e}=yield navigator.storage.estimate();return!!(e&&e<12e7)}return!1})}());const n=window.RequestFileSystem||window.webkitRequestFileSystem;n?n(window.TEMPORARY,100,function(){e(!1)},function(){e(!0)}):e(!1)}}catch(n){console.error(n),e(!1)}else e(!1)})}});