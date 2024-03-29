const moment = require('moment');
const _ = require('lodash');

var editor = ace.edit("col-code-text");
editor.session.setMode("ace/mode/javascript");

let textArea = document.getElementById('col-code-text');
let resultArea = document.getElementById('col-result');
let functionButton = document.getElementsByClassName('col-button-function');
let saveButton = document.getElementById('saveButton');
let saveInput = document.getElementById('saveInput');
let createNewButton = document.getElementById('col-button-createNew');
// Set Default init value to textArea
if(localStorage.getItem('currentFunction')) {
  let value = editor.setValue(localStorage.getItem(localStorage.getItem('currentFunction')) || '');
  saveInput.value = localStorage.getItem(`${localStorage.getItem('currentFunction')}-name`) || '';
  for (let btn of functionButton) {
    if (btn.innerText === localStorage.getItem('currentFunction')) {
      btn.classList.add('active');
    }
  }
  resultArea.innerHTML = JSON.stringify(eval(value), null, 2)
}
textArea.addEventListener('input', function(e) {
  try {
    console.log(e)
    let value = eval(editor.getSession().getValue());
    console.log(editor.getSession().getValue())
    resultArea.innerHTML = JSON.stringify(value, null, 2)
  } catch (error) {
    resultArea.innerHTML = error.message;
  }
})

createNewButton.addEventListener('click', (e) => {
  let button = document.createElement('button');
  button.classList.add('col-button-function');
  button.id = `func-${functionButton.length + 1}`
  button.innerText = 'New Function';
  document.getElementById('col-button').appendChild(button);
  localStorage.setItem(button.id,  "function onInIt() {return [1,2,3,4,5]}\n\n\nonInIt()");
});




for (let btn of functionButton) {
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
saveButton.addEventListener('click', (e) => {
  let currentFunction = localStorage.getItem('currentFunction');
  let value = editor.getSession().getValue();
  console.log(value)
  localStorage.setItem(currentFunction, value)
  let input = saveInput.value;
  localStorage.setItem(`${currentFunction}-name`, input)
});
