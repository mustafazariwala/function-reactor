(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// const moment = require('moment');
// const _ = require('lodash');

let textArea = document.getElementById('col-code-text');
let resultArea = document.getElementById('col-result');

// Set Default init value to textArea
textArea.value = "function onInIt() {return [1,2,3,4,5]}\n\n\nonInIt()"
resultArea.innerHTML = JSON.stringify(eval(textArea.value), null, 2)
textArea.addEventListener('input', function(e) {
  try {
    let value = eval(e.target.value);
    resultArea.innerHTML = JSON.stringify(value, null, 2)
  } catch (error) {
    resultArea.innerHTML = error.message;
  }
})
},{}]},{},[1]);
