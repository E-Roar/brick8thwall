// mock
const event = { detail: { name: 'mural', position: { x: 1 } } }
const process = ({ detail }) => { console.log(detail.name) }
process(event)
