// Filename: read.js 

// Requiring the module
const reader = require('xlsx')

// Reading our test file
const file = reader.readFile('./uploads/1776059698458.xlsx',{
   cellDates:true
})

let data = []

const sheets = file.SheetNames

for(let i = 0; i < sheets.length; i++)
{
   const temp = reader.utils.sheet_to_json(
        file.Sheets[file.SheetNames[i]],{raw: false})
   temp.forEach((res) => {
      data.push(res)
   })
}

// Printing data
console.log(data)
