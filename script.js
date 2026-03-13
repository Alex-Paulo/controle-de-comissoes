// --- SISTEMA DE LOGIN ---
const SENHA_SISTEMA = "1234"; // <-- ALTERE SUA SENHA AQUI

// Verifica se já fez login nesta sessão
if (sessionStorage.getItem("logado") === "true") {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
}

// Função do botão de entrar
function fazerLogin() {
    let senhaDigitada = document.getElementById("senhaLogin").value;
    let erro = document.getElementById("erroLogin");

    if (senhaDigitada === SENHA_SISTEMA) {
        sessionStorage.setItem("logado", "true"); // Salva que está logado
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        erro.style.display = "none";
    } else {
        erro.style.display = "block";
    }
}

// Permite logar apertando "Enter" no teclado
document.getElementById("senhaLogin").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        fazerLogin();
    }
});

let comissoes = JSON.parse(localStorage.getItem("comissoes")) || []
let editando = null

function salvarNoStorage() {
    localStorage.setItem("comissoes", JSON.stringify(comissoes))
}

function adicionarMembro() {
    let container = document.getElementById("membrosContainer")
    let input = document.createElement("input")
    input.type = "text"
    input.placeholder = "Membro"
    input.className = "membro"
    container.appendChild(input)
}

function salvarComissao() {
    let nome = document.getElementById("nomeComissao").value
    let fiscal = document.getElementById("fiscal").value
    let fiscalSubstituto = document.getElementById("fiscalSubstituto").value // Novo campo
    let obs = document.getElementById("observacao").value

    let membrosInputs = document.querySelectorAll(".membro")
    let membros = []

    membrosInputs.forEach(input => {
        if(input.value.trim() !== "") {
            membros.push(input.value)
        }
    })

    let comissao = {
        nome: nome,
        fiscal: fiscal,
        fiscalSubstituto: fiscalSubstituto, // Salvando o novo campo
        membros: membros,
        observacao: obs
    }

    if(editando !== null) {
        comissoes[editando] = comissao
        editando = null
    } else {
        comissoes.push(comissao)
    }

    salvarNoStorage()
    limparCampos()
    atualizarTabela()
    atualizarDashboard()
}

function atualizarTabela(lista = comissoes) {
    let tabela = document.getElementById("listaComissoes")
    tabela.innerHTML = ""

    lista.forEach((c, index) => {
        // Se não tiver substituto, mostra um traço "-"
        let substitutoExibicao = c.fiscalSubstituto ? c.fiscalSubstituto : "-" 

        let linha = `
        <tr>
            <td>${c.nome}</td>
            <td>${c.fiscal}</td>
            <td>${substitutoExibicao}</td>
            <td>${c.membros.join(", ")}</td>
            <td>${c.observacao}</td>
            <td class="acoes">
                <button class="btn-editar" onclick="editar(${index})">Editar</button>
                <button class="btn-excluir" onclick="excluir(${index})">Excluir</button>
            </td>
        </tr>
        `
        tabela.innerHTML += linha
    })
}

function editar(index) {
    let c = comissoes[index]

    document.getElementById("nomeComissao").value = c.nome
    document.getElementById("fiscal").value = c.fiscal
    document.getElementById("fiscalSubstituto").value = c.fiscalSubstituto || "" // Puxando o substituto
    document.getElementById("observacao").value = c.observacao

    let container = document.getElementById("membrosContainer")
    container.innerHTML = ""

    c.membros.forEach(m => {
        let input = document.createElement("input")
        input.type = "text"
        input.className = "membro"
        input.value = m
        container.appendChild(input)
    })

    editando = index
}

function excluir(index) {
    if(confirm("Deseja excluir esta comissão?")) {
        comissoes.splice(index, 1)
        salvarNoStorage()
        atualizarTabela()
        atualizarDashboard()
    }
}

function filtrar() {
    let texto = document.getElementById("filtro").value.toLowerCase()

    let filtrados = comissoes.filter(c => 
        c.nome.toLowerCase().includes(texto) ||
        c.fiscal.toLowerCase().includes(texto) ||
        (c.fiscalSubstituto && c.fiscalSubstituto.toLowerCase().includes(texto)) || // Busca no substituto
        c.membros.join(" ").toLowerCase().includes(texto)
    )

    atualizarTabela(filtrados)
}

function limparCampos() {
    document.getElementById("nomeComissao").value = ""
    document.getElementById("fiscal").value = ""
    document.getElementById("fiscalSubstituto").value = "" // Limpando o substituto
    document.getElementById("observacao").value = ""

    let container = document.getElementById("membrosContainer")
    container.innerHTML = `<input type="text" class="membro" placeholder="Membro">`
}

function exportarExcel() {
    // Nova coluna adicionada ao cabeçalho
    let dados = "Comissão;Fiscal;Substituto;Membros;Observação\n"

    comissoes.forEach(c => {
        let substituto = c.fiscalSubstituto || ""
        dados += `"${c.nome}";"${c.fiscal}";"${substituto}";"${c.membros.join(" - ")}";"${c.observacao}"\n`
    })

    let blob = new Blob(["\ufeff" + dados], { type: "text/csv;charset=utf-8;" })
    let link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "comissoes.csv"
    link.click()
}

function atualizarDashboard() {
    document.getElementById("totalComissoes").innerText = comissoes.length

    let fiscais = new Set()
    let membros = 0

    // O contador de fiscais únicos vai continuar contando apenas os Fiscais Titulares
    comissoes.forEach(c => {
        if(c.fiscal) fiscais.add(c.fiscal)
        membros += c.membros.length
    })

    document.getElementById("totalFiscais").innerText = fiscais.size
    document.getElementById("totalMembros").innerText = membros
}

// Quando a página abrir, já puxa os dados salvos e exibe na tela
atualizarTabela()
atualizarDashboard()

// --- MÁSCARAS E FORMATAÇÃO ---
document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && e.target.id !== 'filtro') {
        let inicio = e.target.selectionStart;
        let fim = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(inicio, fim);
    }
});