const express = require('express');
const app = express();
const readline = require('readline');
const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');
const path = require('path');
const moment = require('moment');
const { spawn } = require('child_process');
const fs = require('fs');
const mongoexpress = require('mongo-express/lib/middleware');




app.use(express.json());
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use('/mongo-express', mongoexpress);


app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


app.get('/folder-content', (req, res) => {
  const folderPath = __dirname;

  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error('Błąd odczytu folderu:', err);
      res.status(500).json({ error: 'Błąd odczytu folderu' });
      return;
    }

    console.log('Zawartość folderu:');
    files.forEach((file) => {
      console.log(file);
    });

    res.json({ files });
  });
});

app.post('/tasks', (req, res) => {
  const { task, time, isAPI, url, params, email } = req.body; 

  const currentTime = new Date();
  const inputTime = new Date(time);

  if (inputTime < currentTime) {
    return res.status(400).json({ error: 'Wprowadzona data nie może być wcześniejsza niż obecna' });
  }

  const formattedTime = new Date(time).toISOString().slice(0, 16);
  const newTodo = new Todo({
    task: task,
    time: formattedTime,
    isAPI: isAPI,
    url: url,
    params: params,
    email: email
  });
  
  newTodo.save()
    .then(() => {
      console.log(`Zadanie dodane: ${task} (czas: ${time})\n`);
      res.status(201).json({ message: 'Zadanie dodane' });
    })
    .catch((error) => {
      console.error('Błąd podczas dodawania zadania:', error);
      res.status(500).json({ error: 'Błąd podczas dodawania zadania' });
    });
});

app.get('/tasks', (req, res) => {
  Todo.find()
    .then((todos) => {
      console.log('Lista zadań:\n');
      const formattedTasks = todos.map((task, index) => {
        let formattedTime;
        if (task.time instanceof Date && !isNaN(task.time)) {
          formattedTime = task.time.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        } else {
          formattedTime = task.time; // Zachowaj niezmienioną wartość, jeśli data jest nieprawidłowa
        }
        let formattedTask = `${index + 1}. ${task.task} (czas: ${formattedTime})`;
        if (task.isAPI) {
          formattedTask += `\n   - Typ: API`;
          formattedTask += `\n   - URL: ${task.url}`;
          formattedTask += `\n   - Parametry: ${task.params}`;
        }
        return formattedTask;
      });
      console.log(formattedTasks.join('\n\n'));
      res.json(todos);
    })
    .catch((error) => {
      console.error('Błąd podczas pobierania zadań:', error);
      res.status(500).json({ error: 'Błąd podczas pobierania zadań' });
    });
});



app.delete('/tasks/:id', (req, res) => {
  const taskId = req.params.id;

  Todo.findByIdAndRemove(taskId)
    .then((removedTask) => {
      if (!removedTask) {
        res.status(404).json({ error: 'Nie znaleziono zadania o podanym numerze porządkowym' });
      } else {
        console.log(`Usunięto zadanie: ${removedTask.task}\n`);
        res.json({ message: 'Zadanie zostało usunięte' });
      }
    })
    .catch((error) => {
      console.error('Błąd podczas usuwania zadania:', error);
      res.status(500).json({ error: 'Błąd podczas usuwania zadania' });
    });
});

app.patch('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;

  Todo.findByIdAndUpdate(taskId, { status }, { new: true })
    .then(updatedTask => {
      if (!updatedTask) {
        res.status(404).json({ error: 'Nie znaleziono zadania o podanym numerze porządkowym' });
      } else {
        console.log(`Zaktualizowano status zadania: ${updatedTask.task} (status: ${updatedTask.status})\n`);
        res.json({ message: 'Status zadania został zaktualizowany' });
      }
    })
    .catch(error => {
      console.error('Błąd podczas aktualizacji statusu zadania:', error);
      res.status(500).json({ error: 'Błąd podczas aktualizacji statusu zadania' });
    });
});

app.get('/api-responses/:id', (req, res) => {
  const responseId = req.params.id;

  APIResponse.findById(responseId)
    .then(response => {
      if (response) {
        res.json(response.response);
      } else {
        res.status(404).json({ error: 'Odpowiedź nie została znaleziona' });
      }
    })
    .catch(error => {
      res.status(500).json({ error: 'Wystąpił błąd podczas pobierania odpowiedzi' });
    });
});

app.listen(3000, () => {
  console.log('Serwer nasłuchuje na porcie 3000\n');
  console.log('Witaj w programie Todo List!\n');

  cron.schedule('* * * * *', () => {
    executePendingAPIs();
  });
});

function executePendingAPIs() {
  let currentTime = new Date();
  currentTime.setHours(currentTime.getHours() + 2);
  currentTime = currentTime.toISOString().slice(0, 16);
  console.log('Bieżąca data i godzina:', currentTime);


  Todo.find({ isAPI: true, time: currentTime })
    .then((todos) => {
      console.log('Pobrane zadania:', todos);

      if (todos.length === 0) {
        console.log('Brak zadań API do wykonania\n');
        return;
      }

      todos.forEach((task) => {
        executeAPI(task.url, task.params)
          .then(() => {
            Todo.findByIdAndUpdate(task._id, { status: 'Completed' }, { new: true })
              .then((updatedTask) => {
                console.log(`Zaktualizowano status zadania: ${updatedTask.task} (status: ${updatedTask.status})\n`);
                sendEmail(updatedTask.task, updatedTask.status, updatedTask.email); 
              })
              .catch((error) => {
                console.error('Błąd podczas aktualizacji statusu zadania:', error);
              });
          })
          .catch((error) => {
            console.error('Błąd podczas wykonywania zadania API:', error);
          });
      });

      console.log('Zadania API zostały wykonane\n');
    })
    .catch((error) => {
      console.error('Błąd podczas przetwarzania zadań API:', error);
    });
}

const executeAPI = (url, params) => {
  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
      .then(response => {
        if (response.data && typeof response.data === 'object') {
          const jsonData = response.data;
          const apiResponse = new APIResponse({
            url: url,
            params: params,
            response: jsonData
          });
          apiResponse.save()
            .then(savedResponse => {
              console.log('Odpowiedź API zapisana w bazie danych');
              console.log('ID zapisanej odpowiedzi:', savedResponse._id);
              resolve(savedResponse._id); 
            })
            .catch(error => {
              console.error('Błąd podczas zapisywania odpowiedzi API:', error);
              reject(error);
            });
        } else {
          console.log('Nie zapisano odpowiedzi API:');
          resolve(null);
        }
      })
      .catch(error => {
        reject(error);
      });
  });
};


function sendEmail(task, status, email) {
  const subject = 'Subject of the Email';
  const body = `Task: ${task}\nStatus: ${status}`;
  const recipient = email;

  const pythonProcess = spawn('python', ['send_email.py', subject, body, recipient]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Wysłano e-mail: ${data}`);
  });


  pythonProcess.stderr.on('data', (data) => {
    console.error(`Błąd podczas wysyłania e-maila: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Proces Pythona zakończony pomyślnie');
    } else {
      console.error(`Proces Pythona zakończony z kodem błędu: ${code}`);
    }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mongoose.connect('mongodb://mongo:27017/todo', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Połączono z bazą danych MongoDB');
  })
  .catch((error) => {
    console.error('Błąd połączenia z bazą danych MongoDB:', error);
    process.exit(1);
  });

  const todoSchema = new mongoose.Schema({
    task: String,
    time: String,
    isAPI: Boolean,
    url: String,
    params: String,
    email: String, 
    status: {
      type: String,
      default: 'Not Completed'
    }
  });

const Todo = mongoose.model('Todo', todoSchema);

const apiResponseSchema = new mongoose.Schema({
  url: String,
  params: String,
  response: Object
});

const APIResponse = mongoose.model('APIResponse', apiResponseSchema);


console.log('Witaj w programie Todo List!\n');
