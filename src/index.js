const moment = require('moment');
const _ = require('lodash');

// Editor Initialization
var editor = ace.edit("col-code-text");
editor.session.setMode("ace/mode/javascript");
editor.setTheme("ace/theme/cobalt");
editor.setOptions({
  enableBasicAutocompletion: true,
  enableLiveAutocompletion: true,
  enableSnippets: true
});
editor.session.setUseWrapMode(true);
editor.commands.addCommand({
  name: 'saveCommand',
  bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
  exec: function(editor) {
    saveButtonFunction()
  },
});

// Get all the elements
let textArea = document.getElementById('col-code-text');
let resultArea = document.getElementById('col-result');
let functionButton = document.getElementsByClassName('col-button-function');
let saveButton = document.getElementById('saveButton');
let deleteButton = document.getElementById('deleteButton');
let saveInput = document.getElementById('saveInput');
let createNewButton = document.getElementById('col-button-createNew');
let copyButton = document.getElementById('col-result-copy-button');
let resultTimeP = document.getElementById('col-result-time');

let changesDone = false;

const OnInIt = () => {
  createAllButton();
  checkForCurrentFunction();
  prepareTextArea();
  prepareNewButton();
  prepareAllButton();
  prepareSaveButton();
  prepareDeleteButton();
  prepareCopyButton();
}

// checkForCurrentFunction checks if there is a current function in the local storage
async function checkForCurrentFunction() {
  let currentFunction = localStorage.getItem('currentFunction');
  if(currentFunction) {
    let value = editor.setValue(localStorage.getItem(currentFunction) || '');
    saveInput.value = localStorage.getItem(`${currentFunction}-name`) || '';
    for (let btn of functionButton) {
      if (btn.innerText === currentFunction) {
        btn.classList.add('active');
      }
    }
    setValue(value)
  }
}

// prepareTextArea prepares the text area for input
function prepareTextArea() {
  // textArea.addEventListener('keyup', function(e) {
  editor.session.on('change', function(e) {
    ChangesDoneFunction(true);
    try {
      let value = editor.getSession().getValue()
      setValue(value)
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
    localStorage.setItem(button.id,  "// Included Script: lodash,moment \n\n function onInIt() {return ''}\n\n\nonInIt()");
    prepareButton(button)
    clickButtonEvent(button.id, button)
  });
}

function getLastNumberFromLocalStorage() {
  let localStorageKeys = Object.keys(localStorage);
  localStorageKeys = localStorageKeys.filter(key => key.match(/\w*-\d*$/));
  if(localStorageKeys && localStorageKeys.length > 0) {
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
    let id = e.target.id;
    clickButtonEvent(id, btn)
  })
}

function clickButtonEvent(id, btn) {
  if(changesDone) {
    let value = confirm('Do you wanna proceed without saving?')
    if(!value) return;
  }
  localStorage.setItem('currentFunction', id);
  editor.setValue(localStorage.getItem(id));
  saveInput.value = localStorage.getItem(`${localStorage.getItem('currentFunction')}-name`) || '';
  btn.classList.add('active');
  for (let btn2 of functionButton) {
    if (btn2 !== btn) {
      btn2.classList.remove('active');
    }
  }
  try {
    setValue(localStorage.getItem(id))
  } catch (error) {
    resultArea.innerHTML = error.message;
  }
  ChangesDoneFunction();
}

// prepareSaveButton prepares the save button
function prepareSaveButton() {
  saveButton.addEventListener('click', (e) => {
    saveButtonFunction()
  });
}

function saveButtonFunction() {
  ChangesDoneFunction()
  let currentFunction = localStorage.getItem('currentFunction');
  let value = editor.getSession().getValue();
  localStorage.setItem(currentFunction, value)
  let input = saveInput.value;
  if(input && input.length > 0 && input.trim().length > 0) {
    localStorage.setItem(`${currentFunction}-name`, input)
    document.getElementById(currentFunction).innerText = input;
  }
}

function createAllButton() {
  let localStorageKeys = Object.keys(localStorage);
  localStorageKeys = localStorageKeys.filter(key => key.match(/\w*-\d*$/));
  for (let key of localStorageKeys) {
    let button = document.createElement('button');
    button.classList.add('col-button-function');
    button.id = key;
    button.innerText = localStorage.getItem(`${key}-name`) || 'New Function';
    document.getElementById('col-button').appendChild(button);
  }
}

function prepareDeleteButton() {
  deleteButton.addEventListener('click', (e) => {
    let currentFunction = localStorage.getItem('currentFunction');
    localStorage.removeItem(currentFunction);
    localStorage.removeItem(`${currentFunction}-name`);
    document.getElementById(currentFunction).remove();
  });
}

function prepareCopyButton() {
  copyButton.addEventListener('click', (e) => {
    navigator.clipboard.writeText(resultArea.innerHTML);
    copyButton.innerText = 'Copied!';
    setTimeout(() => {
      copyButton.innerText = 'Copy';
    }, 1000);
  });
}

function setValue(RawValue, sec = moment().milliseconds() ) {
  let value = eval(RawValue);
  resultArea.innerHTML = JSON.stringify(value, null, 2)
  resultTimeP.innerText = `Took ${moment().milliseconds() - sec}ms to execute`
}

function ChangesDoneFunction(changes = false) {
  changesDone = changes;
  if(changesDone) {
    saveButton.classList.add('active');
  } else {
    saveButton.classList.remove('active');
  }
}

OnInIt();
