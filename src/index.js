const moment = require('moment');
const _ = require('lodash');

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