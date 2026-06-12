'use strict';

/* ============================================================
   Sistema de Reservas de Mesa - lógica do frontend (JS puro)
   ============================================================ */

const API = '/api';

/* ---------- Helpers de requisição ---------- */
async function requisitar(url, opcoes = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || dados.sucesso === false) {
    throw new Error(dados.mensagem || 'Ocorreu um erro na operação.');
  }
  return dados;
}

/* ---------- Toast de mensagens ---------- */
function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.className = `toast ${tipo}`;
  setTimeout(() => toast.classList.add('oculto'), 3500);
}

/* ---------- Formatação de datas ---------- */
function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Converte uma data ISO para o formato aceito por <input type="datetime-local">
function paraInputDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/* ---------- Navegação por abas ---------- */
document.querySelectorAll('.aba').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach((b) => b.classList.remove('ativa'));
    document.querySelectorAll('.painel').forEach((p) => p.classList.remove('ativo'));
    botao.classList.add('ativa');
    document.getElementById(`aba-${botao.dataset.aba}`).classList.add('ativo');

    if (botao.dataset.aba === 'mapa') carregarMapa();
    if (botao.dataset.aba === 'reservas') carregarReservas();
  });
});

/* ============================================================
   MAPA DO SALÃO (planta baixa interativa)
   ============================================================ */

/* Layout (posição no piso e formato) de cada mesa, por número.
   A capacidade, localização e status vêm do backend (/api/mesas). */
const MESAS_LAYOUT = {
  1: { shape: 'round', x: 20, y: 17 }, // Salão
  2: { shape: 'round', x: 42, y: 17 },
  3: { shape: 'rect', x: 20, y: 45 },
  4: { shape: 'rect', x: 42, y: 45 },
  5: { shape: 'rect', x: 31, y: 77 },
  10: { shape: 'rect', x: 47, y: 72 }, // Salão (movida da Área Interna)
  6: { shape: 'round', x: 64, y: 25 }, // Varanda
  7: { shape: 'round', x: 80, y: 15 },
  8: { shape: 'round', x: 90, y: 33 },
  9: { shape: 'rect', x: 66, y: 60 }, // Área Interna
  11: { shape: 'rect', x: 77, y: 84 },
  12: { shape: 'rect', x: 80, y: 58 },
};

const ROTULO_STATUS = {
  disponivel: 'disponível',
  reservado: 'reservado',
  ocupado: 'ocupado',
};

// Converte capacidade em classe de tamanho (cap-2/4/6/8/10).
function classeTamanho(capacidade) {
  if (capacidade <= 2) return 'cap-2';
  if (capacidade <= 4) return 'cap-4';
  if (capacidade <= 6) return 'cap-6';
  if (capacidade <= 8) return 'cap-8';
  return 'cap-10';
}

// Desenha as cadeiras ao redor da mesa conforme a capacidade e o formato.
function cadeiras(capacidade, shape) {
  const out = [];
  const add = (style, v) => out.push(`<span class="chair ${v ? 'v' : ''}" style="${style}"></span>`);
  if (capacidade <= 2) {
    add('top:-13px;left:50%;transform:translateX(-50%)');
    add('bottom:-13px;left:50%;transform:translateX(-50%)');
  } else if (capacidade <= 4 && shape === 'round') {
    add('top:-13px;left:50%;transform:translateX(-50%)');
    add('bottom:-13px;left:50%;transform:translateX(-50%)');
    add('left:-13px;top:50%;transform:translateY(-50%)', true);
    add('right:-13px;top:50%;transform:translateY(-50%)', true);
  } else if (capacidade <= 4) {
    add('top:-13px;left:25%'); add('top:-13px;right:25%');
    add('bottom:-13px;left:25%'); add('bottom:-13px;right:25%');
  } else if (capacidade <= 6) {
    add('top:-13px;left:16%'); add('top:-13px;left:50%;transform:translateX(-50%)'); add('top:-13px;right:16%');
    add('bottom:-13px;left:16%'); add('bottom:-13px;left:50%;transform:translateX(-50%)'); add('bottom:-13px;right:16%');
  } else if (capacidade <= 8) {
    add('top:-13px;left:10%'); add('top:-13px;left:37%'); add('top:-13px;right:37%'); add('top:-13px;right:10%');
    add('bottom:-13px;left:10%'); add('bottom:-13px;left:37%'); add('bottom:-13px;right:37%'); add('bottom:-13px;right:10%');
  } else {
    add('top:-13px;left:8%'); add('top:-13px;left:29%'); add('top:-13px;left:50%;transform:translateX(-50%)'); add('top:-13px;right:29%'); add('top:-13px;right:8%');
    add('bottom:-13px;left:8%'); add('bottom:-13px;left:29%'); add('bottom:-13px;left:50%;transform:translateX(-50%)'); add('bottom:-13px;right:29%'); add('bottom:-13px;right:8%');
  }
  return out.join('');
}

let mesasCache = [];

async function carregarMapa() {
  const floor = document.getElementById('floor');
  const counts = document.getElementById('counts');
  // Remove apenas as mesas (mantém zonas e arquitetura).
  floor.querySelectorAll('.table').forEach((el) => el.remove());

  try {
    const { mesas } = await requisitar(`${API}/mesas`);
    mesasCache = mesas;

    mesas.forEach((mesa) => {
      const layout = MESAS_LAYOUT[mesa.numero];
      if (!layout) return; // mesa sem posição definida no mapa
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `table ${layout.shape} ${classeTamanho(mesa.capacidade)} ${mesa.statusVisual}`;
      btn.style.left = layout.x + '%';
      btn.style.top = layout.y + '%';
      btn.setAttribute(
        'aria-label',
        `Mesa ${mesa.numero}, até ${mesa.capacidade} lugares, ${mesa.localizacao}, ${ROTULO_STATUS[mesa.statusVisual]}`
      );
      btn.innerHTML = `
        <div class="table-shape">
          <span class="table-num">M${mesa.numero}</span>
          <span class="table-cap">${mesa.capacidade}p</span>
          ${cadeiras(mesa.capacidade, layout.shape)}
        </div>`;
      btn.addEventListener('click', () => abrirModalReserva(mesa));
      floor.appendChild(btn);
    });

    const total = mesas.length;
    const livres = mesas.filter((m) => m.statusVisual === 'disponivel').length;
    counts.innerHTML = `<b>${livres}</b>/${total} mesas livres agora`;
  } catch (erro) {
    counts.textContent = erro.message;
  }
}

document.getElementById('btn-atualizar-mapa').addEventListener('click', carregarMapa);

/* ---------- Modal de reserva (a partir do mapa) ---------- */
function abrirModalReserva(mesa) {
  document.getElementById('rm-numeroMesa').value = mesa.numero;
  document.getElementById('modal-mesa-titulo').textContent = `Mesa ${mesa.numero}`;
  document.getElementById('modal-mesa-sub').textContent =
    `${mesa.localizacao} · até ${mesa.capacidade} lugares`;

  const qtd = document.getElementById('rm-quantidadePessoas');
  qtd.max = mesa.capacidade;
  qtd.value = Math.min(2, mesa.capacidade);
  document.getElementById('rm-duracaoMinutos').value = 90;

  // Sugere um horário válido: agora + ~1h05, arredondado para o próximo múltiplo de 15 min.
  const d = new Date(Date.now() + 65 * 60000);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 15) + 15, 0, 0);
  document.getElementById('rm-dataHora').value = paraInputDateTime(d);

  // Caixa de informação conforme o status atual da mesa.
  const info = document.getElementById('modal-mesa-info');
  const r = mesa.reservaAtual;
  if (mesa.statusVisual === 'disponivel') {
    info.className = 'modal-mesa-info ok';
    info.innerHTML =
      '🟢 Mesa disponível. Antecedência mínima de <b>1 hora</b> e duração padrão de <b>1h30</b>.';
  } else if (r) {
    const emoji = mesa.statusVisual === 'ocupado' ? '🔴' : '🟡';
    info.className = `modal-mesa-info ${mesa.statusVisual === 'ocupado' ? 'busy' : 'warn'}`;
    info.innerHTML =
      `${emoji} <b>${escapar(r.nomeCliente)}</b> — ${r.quantidadePessoas} pessoa(s) às ` +
      `<b>${formatarDataHora(r.dataHora)}</b>. Você pode reservar outro horário.`;
  } else {
    info.className = 'modal-mesa-info warn';
    info.innerHTML = 'Mesa com reserva ativa. Você pode reservar outro horário.';
  }

  abrirModal(document.getElementById('modal-mesa'));
  document.getElementById('rm-nomeCliente').focus();
}

// Escapa texto para inserção segura em HTML.
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

/* ---------- Envio da reserva pelo mapa ---------- */
document.getElementById('form-reserva-mapa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = {
    nomeCliente: document.getElementById('rm-nomeCliente').value,
    contatoCliente: document.getElementById('rm-contatoCliente').value,
    numeroMesa: document.getElementById('rm-numeroMesa').value,
    quantidadePessoas: document.getElementById('rm-quantidadePessoas').value,
    dataHora: document.getElementById('rm-dataHora').value,
    duracaoMinutos: document.getElementById('rm-duracaoMinutos').value || 90,
    observacoes: document.getElementById('rm-observacoes').value,
  };
  try {
    const { mensagem } = await requisitar(`${API}/reservas`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    mostrarToast(mensagem, 'sucesso');
    fecharModais();
    e.target.reset();
    carregarMapa();
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }
});

/* ============================================================
   POPULAR SELECTS DE MESAS
   ============================================================ */
async function carregarOpcoesMesas() {
  try {
    const { mesas } = await requisitar(`${API}/mesas`);
    const selects = [
      document.getElementById('numeroMesa'),
      document.getElementById('edit-numeroMesa'),
    ];
    selects.forEach((select) => {
      if (!select) return;
      const valorAtual = select.value;
      select.innerHTML =
        select.id === 'numeroMesa' ? '<option value="">Selecione uma mesa</option>' : '';
      mesas.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.numero;
        opt.textContent = `Mesa ${m.numero} — ${m.localizacao} (até ${m.capacidade})`;
        select.appendChild(opt);
      });
      select.value = valorAtual;
    });
  } catch (erro) {
    console.error(erro);
  }
}

/* ============================================================
   LISTA DE RESERVAS + FILTROS
   ============================================================ */
async function carregarReservas() {
  const corpo = document.getElementById('corpo-reservas');
  corpo.innerHTML = '<tr><td colspan="8" class="carregando">Carregando reservas...</td></tr>';

  const params = new URLSearchParams();
  const cliente = document.getElementById('filtro-cliente').value.trim();
  const mesa = document.getElementById('filtro-mesa').value.trim();
  const data = document.getElementById('filtro-data').value;
  const status = document.getElementById('filtro-status').value;
  if (cliente) params.append('cliente', cliente);
  if (mesa) params.append('mesa', mesa);
  if (data) params.append('data', data);
  if (status) params.append('status', status);

  try {
    const { reservas } = await requisitar(`${API}/reservas?${params.toString()}`);
    if (!reservas.length) {
      corpo.innerHTML = '<tr><td colspan="8" class="vazio">Nenhuma reserva encontrada.</td></tr>';
      return;
    }
    corpo.innerHTML = reservas
      .map(
        (r) => `
      <tr>
        <td>${r.nomeCliente}</td>
        <td>${r.contatoCliente}</td>
        <td>${r.numeroMesa}</td>
        <td>${r.quantidadePessoas}</td>
        <td>${formatarDataHora(r.dataHora)}</td>
        <td>${r.duracaoMinutos} min</td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td class="acoes-celula">
          ${
            r.status === 'cancelado' || r.status === 'finalizado'
              ? ''
              : `<button class="btn-secundario btn-pequeno" onclick="editarReserva('${r._id}')">Editar</button>
                 <button class="btn-perigo btn-pequeno" onclick="cancelarReserva('${r._id}')">Cancelar</button>`
          }
        </td>
      </tr>`
      )
      .join('');
  } catch (erro) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">${erro.message}</td></tr>`;
  }
}

document.getElementById('btn-atualizar-reservas').addEventListener('click', carregarReservas);
document.getElementById('btn-filtrar').addEventListener('click', carregarReservas);
document.getElementById('btn-limpar-filtro').addEventListener('click', () => {
  document.getElementById('filtro-cliente').value = '';
  document.getElementById('filtro-mesa').value = '';
  document.getElementById('filtro-data').value = '';
  document.getElementById('filtro-status').value = '';
  carregarReservas();
});

/* ---------- Cancelar reserva ---------- */
async function cancelarReserva(id) {
  if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;
  try {
    const { mensagem } = await requisitar(`${API}/reservas/${id}`, { method: 'DELETE' });
    mostrarToast(mensagem, 'sucesso');
    carregarReservas();
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }
}

/* ============================================================
   NOVA RESERVA
   ============================================================ */
document.getElementById('form-nova-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const dados = {
    nomeCliente: form.nomeCliente.value,
    contatoCliente: form.contatoCliente.value,
    numeroMesa: form.numeroMesa.value,
    quantidadePessoas: form.quantidadePessoas.value,
    dataHora: form.dataHora.value,
    duracaoMinutos: form.duracaoMinutos.value || 90,
    observacoes: form.observacoes.value,
  };

  try {
    const { mensagem } = await requisitar(`${API}/reservas`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    mostrarToast(mensagem, 'sucesso');
    form.reset();
    form.duracaoMinutos.value = 90;
    document.querySelector('.aba[data-aba="reservas"]').click();
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }
});

/* ============================================================
   EDITAR RESERVA
   ============================================================ */
async function editarReserva(id) {
  try {
    const { reserva } = await requisitar(`${API}/reservas/${id}`);
    document.getElementById('edit-id').value = reserva._id;
    document.getElementById('edit-nomeCliente').value = reserva.nomeCliente;
    document.getElementById('edit-contatoCliente').value = reserva.contatoCliente;
    document.getElementById('edit-numeroMesa').value = reserva.numeroMesa;
    document.getElementById('edit-quantidadePessoas').value = reserva.quantidadePessoas;
    document.getElementById('edit-dataHora').value = paraInputDateTime(reserva.dataHora);
    document.getElementById('edit-duracaoMinutos').value = reserva.duracaoMinutos;
    document.getElementById('edit-observacoes').value = reserva.observacoes || '';
    abrirModal(document.getElementById('modal-editar'));
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }
}

document.getElementById('form-editar-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const dados = {
    nomeCliente: document.getElementById('edit-nomeCliente').value,
    contatoCliente: document.getElementById('edit-contatoCliente').value,
    numeroMesa: document.getElementById('edit-numeroMesa').value,
    quantidadePessoas: document.getElementById('edit-quantidadePessoas').value,
    dataHora: document.getElementById('edit-dataHora').value,
    duracaoMinutos: document.getElementById('edit-duracaoMinutos').value,
    observacoes: document.getElementById('edit-observacoes').value,
  };
  try {
    const { mensagem } = await requisitar(`${API}/reservas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dados),
    });
    mostrarToast(mensagem, 'sucesso');
    fecharModais();
    carregarReservas();
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }
});

/* ============================================================
   MODAIS
   ============================================================ */
function abrirModal(modal) {
  modal.classList.remove('oculto');
}
function fecharModais() {
  document.querySelectorAll('.modal').forEach((m) => m.classList.add('oculto'));
}
document.querySelectorAll('[data-fechar]').forEach((b) =>
  b.addEventListener('click', fecharModais)
);
document.querySelectorAll('.modal').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModais();
  });
});

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
carregarMapa();
carregarOpcoesMesas();

// Reavalia o status das mesas conforme o tempo passa (só quando o mapa está visível).
setInterval(() => {
  if (document.getElementById('aba-mapa').classList.contains('ativo')) {
    carregarMapa();
  }
}, 60000);
