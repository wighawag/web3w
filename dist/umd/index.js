var __awaiter=this&&this.__awaiter||function(e,t,o,n){return new(o||(o=Promise))(function(i,r){function s(e){try{d(n.next(e))}catch(e){r(e)}}function a(e){try{d(n.throw(e))}catch(e){r(e)}}function d(e){var t;e.done?i(e.value):(t=e.value,t instanceof o?t:new o(function(e){e(t)})).then(s,a)}d((n=n.apply(e,t||[])).next())})};!function(e){if("object"==typeof module&&"object"==typeof module.exports){var t=e(require,exports);void 0!==t&&(module.exports=t)}else"function"==typeof define&&define.amd&&define(["require","exports","@ethersproject/contracts","@ethersproject/providers","./utils/store","./utils/builtin","./utils/index.js","./utils/ethers","named-logs"],e)}(function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const o=e("@ethersproject/contracts"),n=e("@ethersproject/providers"),i=e("./utils/store"),r=e("./utils/builtin"),s=e("./utils/index.js"),a=e("./utils/ethers"),d=e("named-logs").logs("web3w:index"),c="undefined"!=typeof window,l={state:"Idle",loading:!1,available:void 0,error:void 0,vendor:void 0},u={state:"Idle",loading:!1,stale:void 0,amount:void 0,error:void 0,blockNumber:void 0},g={state:"Idle",loading:!1,contracts:{},error:void 0},f={state:"Idle",loading:!1,unlocking:!1,address:void 0,options:void 0,selected:void 0,pendingUserConfirmation:void 0,error:void 0};function v(e){const t=i.writable(e);return t.data=e,t}const h=[],m=v(f),b=v(h),p=v(l),w=v(g),y=v(u);function C(e,t){for(const o of Object.keys(t)){const n=t,i=e;if(i.data[o]&&"object"==typeof n[o])for(const e of Object.keys(n[o]))i.data[o][e]=n[o][e];else i.data[o]=n[o]}try{d.debug(JSON.stringify(e.data,null,"  "))}catch(t){d.error(t,e.data)}e.set(e.data)}let I,x,_,k,S,E,j;function R(...e){d.debug("onChainChanged",...e)}function U(...e){d.debug("onAccountsChanged",...e)}function P(...e){d.debug("onConnect",...e)}function L(...e){d.debug("onDisconnect",...e)}function T(e){return"string"==typeof e&&e.length>2&&"0x"===e.slice(0,2).toLowerCase()}function N(e){f.pendingUserConfirmation?f.pendingUserConfirmation.push(e):f.pendingUserConfirmation=[e],C(m,{pendingUserConfirmation:f.pendingUserConfirmation})}function $(e){if(f.pendingUserConfirmation){const t=f.pendingUserConfirmation.indexOf(e);t>=0&&(f.pendingUserConfirmation.splice(t,1),0===f.pendingUserConfirmation.length&&(f.pendingUserConfirmation=void 0),C(m,{pendingUserConfirmation:f.pendingUserConfirmation}))}}const q={onTxRequested:e=>{N("transaction")},onTxCancelled:e=>{$("transaction")},onTxSent:e=>{$("transaction")},onSignatureRequested:e=>{N("signature")},onSignatureCancelled:e=>{$("signature")},onSignatureReceived:e=>{$("signature")},onContractTxRequested:({name:e,method:t,overrides:o,outcome:n})=>{d.debug("onContractTxRequest",{name:e,method:t,overrides:o,outcome:n})},onContractTxCancelled:({name:e,method:t,overrides:o,outcome:n})=>{d.debug("onContractTxCancelled",{name:e,method:t,overrides:o,outcome:n})},onContractTxSent:({hash:e,name:t,method:o,overrides:n,outcome:i})=>{e?function(e){h.push(e),b.set(h)}({hash:e,name:t,method:o,overrides:n,outcome:i}):d.debug("onContractTxSent",{hash:e,name:t,method:o,overrides:n,outcome:i})}},O="_web3w_previous_wallet_type";function W(e){localStorage.setItem(O,e)}function A(e){return __awaiter(this,void 0,void 0,function*(){if(null===I){const e={message:"no provider setup yet"};throw C(w,{error:e,loading:!1,state:"Idle"}),new Error(e.message)}C(w,{loading:!0});const t={},n={};let i={};const{chainId:r}=yield I.getNetwork(),s=String(r);let d=S;if("function"==typeof d&&(d=yield d(s)),d){if(d.chainId){const e=d;if(s!==e.chainId&&s!=(T(c=e.chainId)?""+parseInt(c.slice(2)):c)){const t={message:`chainConfig only available for ${e.chainId} , not available for ${s}`};throw C(w,{error:t,chainId:s,notSupported:!0,loading:!1,state:"Idle"}),new Error(t.message)}i=e.contracts}else{const e=d,t=e[s]||e[function(e){return T(e)?e:"0x"+parseInt(e).toString(16)}(s)];if(!t){const e={message:`chainConfig not available for ${s}`};throw C(w,{error:e,chainId:s,notSupported:!0,loading:!1,state:"Idle"}),new Error(e.message)}i=t.contracts}for(const r of Object.keys(i)){if("status"===r){const e={message:'invalid name for contract : "status"'};throw C(w,{error:e,state:"Idle",loading:!1}),new Error(e.message)}if("error"===r){const e={message:'invalid name for contract : "error"'};throw C(w,{error:e,state:"Idle",loading:!1}),new Error(e.message)}const s=i[r];s.abi&&(t[r]=a.proxyContract(new o.Contract(s.address,s.abi,I.getSigner(e)),r,q)),n[r]=s.address}}var c;C(w,{state:"Ready",loading:void 0,chainId:s,addresses:n,contracts:t})})}function M(e,t){return __awaiter(this,void 0,void 0,function*(){!f.selected||"Ready"!==f.state&&"Locked"!==f.state||(yield F());let o,i=e;if(!i)if(0===j.length)i="builtin";else{if(1!==j.length){const e=`No Wallet Type Specified, choose from ${f.options}`;throw new Error(e)}i=j[0]}if("builtin"==i&&"Ready"===l.state&&!l.available){throw new Error("No Builtin Wallet")}if(C(m,{address:void 0,loading:!0,selected:e,state:"Idle",error:void 0}),I=null,x=null,"builtin"===i)E=void 0,yield J(),I=_,x=k;else{let o;if("string"==typeof i){if(j)for(const t of j)"string"!=typeof t&&t.id===e&&(o=t)}else e=(o=i).id;if(!o){const t=`no module found ${e}`;throw C(m,{error:{message:t,code:1},selected:void 0,loading:!1}),new Error(t)}try{const{chainId:e,web3Provider:i}=yield o.setup(t);x=i,I=a.proxyWeb3Provider(new n.Web3Provider(x),q),E=o}catch(e){throw"USER_CANCELED"===e.message?C(m,{loading:!1,selected:void 0}):C(m,{error:{message:e.message},selected:void 0,loading:!1}),e}}if(!I){const t=`no provider found for wallet type ${e}`;throw C(m,{error:{message:t,code:1},selected:void 0,loading:!1}),new Error(t)}x&&(d.debug("listenning for connection..."),x.on("connect",P),x.on("disconnect",L));try{o="builtin"===e&&"Metamask"===l.vendor?yield s.timeout(2e3,I.listAccounts(),{error:'Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)'}):yield s.timeout(2e4,I.listAccounts())}catch(e){throw C(m,{error:e,selected:void 0,loading:!1}),e}W(e);const r=o&&o[0];r?(C(m,{address:r,state:"Ready",loading:void 0}),x&&(d.debug("listenning for changes..."),x.on("chainChanged",R),x.on("accountsChanged",U)),yield A(r)):C(m,{address:void 0,state:"Locked",loading:void 0})})}let D,B;function J(e={}){return D||(D=new Promise((e,t)=>__awaiter(this,void 0,void 0,function*(){if("Ready"===l.state)return e();C(p,{loading:!0});try{const e=yield r.fetchEthereum();e?(k=e,_=a.proxyWeb3Provider(new n.Web3Provider(e),q),C(p,{state:"Ready",vendor:r.getVendor(e),available:!0,loading:void 0})):C(p,{state:"Ready",vendor:void 0,available:!1,loading:void 0})}catch(e){return C(p,{error:e.message||e,vendor:void 0,available:void 0,loading:!1}),t(e)}e()})))}function V(e,t){return __awaiter(this,void 0,void 0,function*(){return yield M(e,t),"Locked"!==f.state||G()})}function z(e){F()}function F(){return __awaiter(this,void 0,void 0,function*(){x&&(d.debug("stop listenning for changes..."),x.removeListener("chainChanged",R),x.removeListener("accountsChanged",U)),x&&(d.debug("stop listenning for connection..."),x.removeListener("connect",P),x.removeListener("disconnect",L)),E&&(yield E.logout(),E=void 0),C(m,{state:"Idle",address:void 0,loading:!1,unlocking:void 0,selected:void 0,error:void 0}),C(y,{state:"Idle",amount:void 0,error:void 0,blockNumber:void 0}),C(w,{contracts:void 0,state:"Idle",notSupported:void 0,chainId:void 0,error:void 0}),W("")})}function G(){if(B)return B;let e=!1;const t=new Promise((t,o)=>__awaiter(this,void 0,void 0,function*(){if("Locked"===f.state){let o;C(m,{unlocking:!0});try{o=(o=yield null==I?void 0:I.send("eth_requestAccounts",[]))||[]}catch(e){o=[]}if(!(o.length>0))return C(m,{unlocking:!1}),B=void 0,e=!0,t(!1);{const e=o[0];C(m,{address:e,state:"Ready",unlocking:void 0}),yield A(e)}return B=void 0,e=!0,t(!0)}return e=!0,o(new Error("Not Locked"))}));return e||(B=t),t}t.default=(e=>{(e=Object.assign({},e||{})).builtin=e.builtin||{};const{debug:t,chainConfigs:o,builtin:n}=e;if(S=o,t&&"undefined"!=typeof window&&(window.$wallet=f,window.$transactions=h),j=e.options||[],C(m,{state:"Idle",options:j.map(e=>{if("object"==typeof e){if(!e.id)throw new Error("options need to be string or have an id");return e.id}return e})}),C(p,{state:"Idle"}),C(w,{state:"Idle"}),C(y,{state:"Idle"}),c){if(e.autoSelectPrevious){const e=localStorage.getItem(O);e&&""!==e&&M(e)}e.builtin.autoProbe&&J(e.builtin)}return{transactions:{subscribe:b.subscribe},balance:{subscribe:y.subscribe},chain:{subscribe:w.subscribe},builtin:{subscribe:p.subscribe,probe:J},wallet:{subscribe:m.subscribe,connect:V,unlock:G,acknowledgeError:z,logout:F,get address(){return f.address},get provider(){return I},get web3Provider(){return x},get chain(){return g},get contracts(){return g.contracts},get balance(){return u.amount}}}})});