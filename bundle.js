(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

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
editor.commands.addCommand({
  name: 'saveCommand',
  bindKey: {win: "Ctrl-'",  mac: "Command-'"},
  exec: async function(editor) {
    await loadTextArea()
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
let settingButton = document.getElementById("settingButton");
let settingModal = document.getElementById("settingModal");
let span = document.getElementById("settingModalClose");
let displayTable = document.getElementById("display-table");
let scriptSearchInput = document.getElementById("scriptSearchInput");
let scriptSearchButton = document.getElementById("scriptSearchButton");
let instantReloadCheckbox = document.getElementById("instant-reload-checkbox");

let changesDone = false;

const OnInIt = async () => {
  await loadScriptFromLocalStorage();
  window.addEventListener('load', async function() {
    // your code here
    createAllButton();
    await checkForCurrentFunction();
    prepareTextArea();
    await prepareNewButton();
    await prepareAllButton();
    prepareSaveButton();
    prepareDeleteButton();
    prepareCopyButton();
    await setupModal();
  })
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
    await setValue(value)
  }
}

// prepareTextArea prepares the text area for input
async function prepareTextArea(ignoreCheckbox = false) {
  // textArea.addEventListener('keyup', function(e) {
  await editor.session.on('change', async function(e) {
    if(instantReloadCheckbox.checked) {
      await loadTextArea();
    }
  })
}

async function loadTextArea() {
  ChangesDoneFunction(true);
    try {
      let value = editor.getSession().getValue()
      await setValue(value)
    } catch (error) {
      resultArea.innerHTML = error.message;
    }
}
// prepareNewButton prepares the new button
async function prepareNewButton() {
  await createNewButton.addEventListener('click', async (e) => {
    let button = document.createElement('button');
    button.classList.add('col-button-function');
    button.id = `func-${getLastNumberFromLocalStorage()}`
    button.innerText = 'New Function';
    document.getElementById('col-button').appendChild(button);
    localStorage.setItem(button.id,  "\n\nfunction onInIt() {\n  return '' \n}\n\n\nonInIt()");
    prepareButton(button)
    await clickButtonEvent(button.id, button)
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
async function prepareAllButton() {
  for (let btn of functionButton) {
    await prepareButton(btn);
  }
}

async function prepareButton(btn) {
  await btn.addEventListener('click', async (e) => {
    let id = e.target.id;
    await clickButtonEvent(id, btn)
  })
}

async function clickButtonEvent(id, btn) {
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
    await setValue(localStorage.getItem(id))
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

async function setValue(RawValue, sec = Date.now() ) {
  try {
    resultArea.innerHTML = 'Loading...';
    let value = await eval(RawValue);
    resultArea.innerHTML = JSON.stringify(value, null, 2)
    resultTimeP.innerText = `Took ${Date.now() - sec}sec to execute`
  // console.log(Date.now())
  } catch (error) {
    resultArea.innerHTML = error.message
  }
}

function ChangesDoneFunction(changes = false) {
  changesDone = changes;
  if(changesDone) {
    saveButton.classList.add('active');
  } else {
    saveButton.classList.remove('active');
  }
}

async function setupModal() {
  settingButton.onclick = function() {
    settingModal.style.display = "block";
    searchScript()
  }
  span.onclick = function() {
    settingModal.style.display = "none";
  }
  window.onclick = function(event) {
    if (event.target == settingModal) {
      settingModal.style.display = "none";
    }
  }
  scriptSearchButton.onclick = (e) => {
    let value = scriptSearchInput.value;
    if(value && value.length > 0) {
      searchScript(value)
    }
  };
  scriptSearchInput.addEventListener('keyup', (e) => {
    if(e.keyCode === 13) {
      console.log('Hit Enter')
      let value = scriptSearchInput.value;
      if(value && value.length > 0) {
        searchScript(value)
      }
    }
  })
}

async function searchScript(searchInput) {
  displayTable.children[1].innerHTML = 'Loading...';
  const params = new URLSearchParams({search: searchInput || '', limit: 30, fields: 'name,latest,description,version'});
  let url = `https://api.cdnjs.com/libraries?${params}`;
  let response = await fetch(url);
  let libraries = await response.json();
  let tableRow = document.createElement('tbody');
  for(let lib of libraries.results) {
    let tr = document.createElement('tr');
    let name = document.createElement('td');
    name.innerText = lib.name;
    tr.appendChild(name);
    let description = document.createElement('td');
    description.innerText = lib.description;
    description.style.textOverflow = 'ellipsis';
    tr.appendChild(description);
    let version = document.createElement('td');
    version.innerText = lib.version;
    tr.appendChild(version);
    let link = document.createElement('td');
    let addToHeader = document.createElement('button');
    addToHeader.classList.add('button');
    addToHeader.innerText = 'Add'
    let scripts = localStorage.getItem('scripts');
    scripts = scripts ? JSON.parse(scripts) : {};
    if(scripts[lib.name]) {
      addToHeader.innerText = 'Remove'
      addToHeader.classList.add('delete');
      // addToHeader.disabled = true;
    }

    addToHeader.addEventListener('click', async (e) => {
      let scripts = localStorage.getItem('scripts');
      scripts = scripts ? JSON.parse(scripts) : {};
      if(!scripts[lib.name]) {
        let script = document.createElement('script');
        script.src = lib.latest;
        script.id = lib.name;
        scripts[lib.name] = lib.latest;
        localStorage.setItem('scripts', JSON.stringify(scripts))
        document.head.appendChild(script);
        addToHeader.innerText = 'Remove'
        addToHeader.classList.add('delete');
      } else {
        delete scripts[lib.name];
        localStorage.setItem('scripts', JSON.stringify(scripts))
        document.getElementById(lib.name).remove();
        addToHeader.innerText = 'Add'
        addToHeader.classList.remove('delete');
      }
    })
    link.appendChild(addToHeader);
    tr.appendChild(link);
    tableRow.appendChild(tr);
  }
  displayTable.children[1].replaceWith(tableRow);
}

async function loadScriptFromLocalStorage() {
  let scripts = localStorage.getItem('scripts');
  if (scripts) {
    scripts = JSON.parse(scripts);
    for(let key in scripts) {
      let script = document.createElement('script');
      script.src = scripts[key];
      script.id = key;
      document.head.appendChild(script);
    }
  }
}




OnInIt();

},{}]},{},[1]);
