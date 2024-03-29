const moment = require('moment');
const _ = require('lodash');

// Editor Initialization
var editor = ace.edit("col-code-text");
editor.session.setMode("ace/mode/javascript");

// Get all the elements
let textArea = document.getElementById('col-code-text');
let resultArea = document.getElementById('col-result');
let functionButton = document.getElementsByClassName('col-button-function');
let saveButton = document.getElementById('saveButton');
let deleteButton = document.getElementById('deleteButton');
let saveInput = document.getElementById('saveInput');
let createNewButton = document.getElementById('col-button-createNew');

const OnInIt = () => {
  checkForCurrentFunction();
  prepareTextArea();
  prepareNewButton();
  prepareAllButton();
  prepareSaveButton();
}

// checkForCurrentFunction checks if there is a current function in the local storage
function checkForCurrentFunction() {
  let currentFunction = localStorage.getItem('currentFunction');
  if(currentFunction) {
    let value = editor.setValue(localStorage.getItem(currentFunction) || '');
    saveInput.value = localStorage.getItem(`${currentFunction}-name`) || '';
    for (let btn of functionButton) {
      if (btn.innerText === currentFunction) {
        btn.classList.add('active');
      }
    }
    resultArea.innerHTML = JSON.stringify(eval(value), null, 2)
  }
}

// prepareTextArea prepares the text area for input
function prepareTextArea() {
  textArea.addEventListener('input', function(e) {
    try {
      let value = editor.getSession().getValue()
      resultArea.innerHTML = JSON.stringify(eval(value), null, 2)
    } catch (error) {
      resultArea.innerHTML = error.message;
    }
  })
}

// prepareNewButton prepares the new button
function prepareNewButton() {
  createNewButton.addEventListener('click', (e) => {
    let button = document.createElement('button');
    button.classList.add('col-button-function');
    button.id = `func-${getLastNumberFromLocalStorage()}`
    button.innerText = 'New Function';
    document.getElementById('col-button').appendChild(button);
    localStorage.setItem(button.id,  "function onInIt() {return [1,2,3,4,5]}\n\n\nonInIt()");
    prepareButton(button)
  });
}

function getLastNumberFromLocalStorage() {
  let localStorageKeys = Object.keys(localStorage);
  if(localStorageKeys && localStorageKeys.length > 0) {
    localStorageKeys = localStorageKeys.filter(key => key.match(/\w*-\d*$/));
    localStorageKeys = localStorageKeys.map(key => parseInt(key.split('-')[1])).sort(function (a, b) {  return a - b;  })
    return localStorageKeys[localStorageKeys.length - 1] + 1
  }
  return 1;
}

// prepareAllButton prepares all the buttons
function prepareAllButton() {
  for (let btn of functionButton) {
    prepareButton(btn);
  }
}

function prepareButton(btn) {
  btn.addEventListener('click', (e) => {
    localStorage.setItem('currentFunction', e.target.id);
    editor.setValue(localStorage.getItem(e.target.id));
    saveInput.value = localStorage.getItem(`${localStorage.getItem('currentFunction')}-name`) || '';
    btn.classList.add('active');
    for (let btn2 of functionButton) {
      if (btn2 !== btn) {
        btn2.classList.remove('active');
      }
    }
    try {
      let value = eval(localStorage.getItem(e.target.id));
      resultArea.innerHTML = JSON.stringify(value, null, 2)
    } catch (error) {
      resultArea.innerHTML = error.message;
    }
  })
}

// prepareSaveButton prepares the save button
function prepareSaveButton() {
  saveButton.addEventListener('click', (e) => {
    let currentFunction = localStorage.getItem('currentFunction');
    let value = editor.getSession().getValue();
    localStorage.setItem(currentFunction, value)
    let input = saveInput.value;
    localStorage.setItem(`${currentFunction}-name`, input)
    document.getElementById(currentFunction).innerText = input;
  });
}

let localStorageKeys = Object.keys(localStorage);
localStorageKeys = localStorageKeys.filter(key => key.match(/\w*-\d*$/));
for (let key of localStorageKeys) {
  let button = document.createElement('button');
  button.classList.add('col-button-function');
  button.id = key;
  button.innerText = localStorage.getItem(`${key}-name`) || 'New Function';
  document.getElementById('col-button').appendChild(button);
}

OnInIt();
