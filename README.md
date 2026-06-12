# Hungry Bug — Sistema de Reservas de Mesa

Sistema para gerenciar reservas de mesas do restaurante **Hungry Bug**, desenvolvido
para a **Prova 2 – Desenvolvimento Web III** (TypeScript + MongoDB).

> Identidade visual: verde escuro + branco, com o símbolo de uma cabeça de louva-a-deus.

Permite registrar, visualizar, atualizar e cancelar reservas, verificando a
disponibilidade das mesas e aplicando regras de negócio. Inclui um **mapa visual
das mesas** com cores indicando o status.

---

## Tecnologias

- **Backend:** Node.js + TypeScript + Express
- **Banco de dados:** MongoDB (via Mongoose) — banco `reserva`
- **Frontend:** HTML + CSS + JavaScript puro (consumindo a API REST)
- **Execução:** servidor único em `http://localhost:3000`

---

## Estrutura do projeto

```
.
├── src/
│   ├── server.ts              # Servidor Express + arquivos estáticos
│   ├── seed.ts                # Popula o banco com as mesas iniciais
│   ├── config/db.ts           # Conexão com o MongoDB
│   ├── models/
│   │   ├── Mesa.ts            # Modelo Mesa
│   │   └── Reserva.ts         # Modelo Reserva
│   ├── services/
│   │   └── reservaService.ts  # Regras de negócio e cálculo de status
│   ├── controllers/
│   │   ├── mesaController.ts
│   │   └── reservaController.ts
│   ├── routes/
│   │   ├── mesaRoutes.ts
│   │   └── reservaRoutes.ts
│   └── utils/logger.ts        # Registro de logs (criação/atualização/cancelamento)
├── public/                    # Frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── .env.example
├── tsconfig.json
└── package.json
```

---

## Pré-requisitos

- **Node.js** 18+ (testado com Node 20)
- **MongoDB** em execução

### Como rodar o MongoDB

**Opção A — MongoDB instalado na máquina (serviço):**
```bash
sudo systemctl start mongod
```

**Opção B — MongoDB via Docker:**
```bash
docker run -d --name mongo-reserva -p 27017:27017 mongo:7
```

**Opção C — MongoDB em modo usuário (sem sudo):**
```bash
mkdir -p ~/.local/share/mongodb-reserva/data
mongod --dbpath ~/.local/share/mongodb-reserva/data --port 27017
```

> Por padrão a aplicação conecta em `mongodb://localhost:27017/reserva`.

---

## Instalação e execução

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# (ajuste a MONGODB_URI se necessário)

# 3. Popular o banco com as mesas iniciais (arquivo pré-pronto)
npm run seed

# 3.1 (opcional) Popular reservas de demonstração para testar os estados das mesas
#     (cria mesas ocupadas, reservadas, finalizada e cancelada)
npm run seed:reservas

# 4. Iniciar a aplicação
npm start
```

Acesse: **http://localhost:3000**

> Para desenvolvimento com recarga automática: `npm run dev`

---

## Rotas da API

### Reservas — `/api/reservas`

| Método | Rota                | Descrição                                              |
|--------|---------------------|--------------------------------------------------------|
| POST   | `/api/reservas`     | Criar uma nova reserva                                 |
| GET    | `/api/reservas`     | Listar reservas (filtros: `cliente`, `mesa`, `data`, `status`) |
| GET    | `/api/reservas/:id` | Obter uma reserva                                      |
| PUT    | `/api/reservas/:id` | Atualizar uma reserva                                  |
| DELETE | `/api/reservas/:id` | Cancelar uma reserva (status → `cancelado`)            |

**Exemplo de filtro:** `GET /api/reservas?status=reservado&mesa=3&data=2026-06-15`

### Mesas — `/api/mesas`

| Método | Rota                  | Descrição                                            |
|--------|-----------------------|------------------------------------------------------|
| GET    | `/api/mesas`          | Listar mesas com status visual (para o mapa)         |
| GET    | `/api/mesas/:numero`  | Detalhes de uma mesa + reservas ativas               |
| POST   | `/api/mesas`          | Cadastrar uma nova mesa                              |

### Exemplo de criação de reserva
```bash
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -d '{
    "nomeCliente": "Maria Silva",
    "contatoCliente": "(11) 99999-0000",
    "numeroMesa": 3,
    "quantidadePessoas": 4,
    "dataHora": "2026-06-15T20:00",
    "observacoes": "Aniversário"
  }'
```

---

## Regras de negócio implementadas

- Não permite duas reservas para a mesma mesa em horários sobrepostos.
- Toda reserva tem horário inicial e **duração padrão de 1h30** (90 min, configurável).
- Reservas exigem **antecedência mínima de 1 hora**.
- O **status é atualizado automaticamente** conforme o tempo:
  - `reservado` – agendada (ainda não começou)
  - `ocupado` – horário atual dentro do intervalo
  - `finalizado` – horário encerrado
  - `cancelado` – removida pelo usuário
- Valida se a **mesa comporta a quantidade de pessoas** da reserva.

---

## Mapa Visual das Mesas

Na aba **"Mapa de Mesas"**, cada mesa é exibida com uma cor de status:

- 🟢 **Verde** – disponível
- 🟡 **Amarelo** – reservado
- 🔴 **Vermelho** – ocupado

Ao clicar em uma mesa, são exibidos seus detalhes (capacidade, localização,
reservas ativas) e a opção de **reservar**.

---

## Modelo de dados

### Reserva
| Campo               | Tipo    | Observação                                  |
|---------------------|---------|---------------------------------------------|
| `nomeCliente`       | String  | obrigatório                                 |
| `contatoCliente`    | String  | obrigatório                                 |
| `numeroMesa`        | Number  | obrigatório                                 |
| `quantidadePessoas` | Number  | obrigatório                                 |
| `dataHora`          | Date    | obrigatório (horário inicial)               |
| `duracaoMinutos`    | Number  | padrão 90                                   |
| `observacoes`       | String  | opcional                                    |
| `status`            | String  | `reservado` / `ocupado` / `finalizado` / `cancelado` |

### Mesa
| Campo         | Tipo   | Observação                                  |
|---------------|--------|---------------------------------------------|
| `numero`      | Number | único, obrigatório                          |
| `capacidade`  | Number | obrigatório                                 |
| `localizacao` | String | `Salão` / `Varanda` / `Área Interna`        |

---

## Logs

As operações de criação, atualização e cancelamento são registradas no console e
no arquivo `logs/app.log`.
