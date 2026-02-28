import express from 'express'

const app = express()
app.use(express.json())
    
const users = []

app.post('/user', (req, res) => {
    users.push(req.body)
    res.status(201).json(req.body)
})

app.get('/user', (req, res) => {
    res.status(200).json(users)
})

app.listen(3000)
