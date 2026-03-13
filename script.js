// --- CONEXÃO COM O SUPABASE ---
// Mudamos o nome da variável para 'banco' para não dar conflito com a biblioteca
const banco = supabase.createClient(supabaseUrl, supabaseKey);

// --- SISTEMA DE LOGIN ---
const SENHA_SISTEMA = "270326"; // Lembre-se de colocar a sua senha real aqui

if (sessionStorage.getItem("logado") === "true") {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    carregarComissoes(); // Carrega os dados do banco assim que entra
}

function fazerLogin() {
    let senhaDigitada = document.getElementById("senhaLogin").value;
    let erro = document.getElementById("erroLogin");

    if (senhaDigitada === SENHA_SISTEMA) {
        sessionStorage.setItem("logado", "true");
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        erro.style.display = "none";
        carregarComissoes(); // Traz os dados da nuvem
    } else {
        erro.style.display = "block";
    }
}

document.getElementById("senhaLogin").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        fazerLogin();
    }
});

// --- VARIÁVEIS GLOBAIS ---
let comissoes = [];
let editandoId = null; 

// --- FUNÇÕES DO BANCO DE DADOS (CRUD) ---

// 1. LER: Busca os dados no Supabase
async function carregarComissoes() {
    const { data, error } = await banco
        .from('comissoes')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Erro ao carregar dados:", error);
        return;
    }

    comissoes = data || [];
    atualizarTabela();
    atualizarDashboard();
}

// 2. CRIAR E ATUALIZAR
async function salvarComissao() {
    let nome = document.getElementById("nomeComissao").value;
    let fiscal = document.getElementById("fiscal").value;
    let fiscalSubstituto = document.getElementById("fiscalSubstituto").value;
    let obs = document.getElementById("observacao").value;

    let membrosInputs = document.querySelectorAll(".membro");
    let membros = [];

    membrosInputs.forEach(input => {
        if(input.value.trim() !== "") {
            membros.push(input.value);
        }
    });

    let dadosComissao = {
        nome: nome,
        fiscal: fiscal,
        fiscal_substituto: fiscalSubstituto,
        membros: membros,
        observacao: obs
    };

    if(editandoId !== null) {
        // ATUALIZAR (UPDATE no banco)
        const { error } = await banco
            .from('comissoes')
            .update(dadosComissao)
            .eq('id', editandoId);

        if (error) console.error("Erro ao atualizar:", error);
        editandoId = null;
    } else {
        // INSERIR (INSERT no banco)
        const { error } = await banco
            .from('comissoes')
            .insert([dadosComissao]);

        if (error) console.error("Erro ao inserir:", error);
    }

    limparCampos();
    await carregarComissoes(); 
}

// 3. DELETAR
async function excluir(id) {
    if(confirm("Deseja excluir esta comissão definitivamente?")) {
        const { error } = await banco
            .from('comissoes')
            .delete()
            .eq('id', id);

        if (error) console.error("Erro ao excluir:", error);
        await carregarComissoes();
    }
}

// --- INTERFACE E LÓGICA DA TELA ---

function adicionarMembro() {
    let container = document.getElementById("membrosContainer");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Membro";
    input.className = "membro";
    container.appendChild(input);
}

function atualizarTabela(lista = comissoes) {
    let tabela = document.getElementById("listaComissoes");
    tabela.innerHTML = "";

    lista.forEach((c, index) => {
        let substitutoExibicao = c.fiscal_substituto ? c.fiscal_substituto : "-";
        let observacaoExibicao = c.observacao ? c.observacao : "";

        let linha = `
        <tr>
            <td>${c.nome}</td>
            <td>${c.fiscal}</td>
            <td>${substitutoExibicao}</td>
            <td>${c.membros.join(", ")}</td>
            <td>${observacaoExibicao}</td>
            <td class="acoes">
                <button class="btn-editar" onclick="editar(${index})">Editar</button>
                <button class="btn-excluir" onclick="excluir(${c.id})">Excluir</button>
            </td>
        </tr>
        `;
        tabela.innerHTML += linha;
    });
}

function editar(index) {
    let c = comissoes[index];

    document.getElementById("nomeComissao").value = c.nome;
    document.getElementById("fiscal").value = c.fiscal;
    document.getElementById("fiscalSubstituto").value = c.fiscal_substituto || "";
    document.getElementById("observacao").value = c.observacao || "";

    let container = document.getElementById("membrosContainer");
    container.innerHTML = "";

    c.membros.forEach(m => {
        let input = document.createElement("input");
        input.type = "text";
        input.className = "membro";
        input.value = m;
        container.appendChild(input);
    });

    editandoId = c.id; 
}

function filtrar() {
    let texto = document.getElementById("filtro").value.toLowerCase();

    let filtrados = comissoes.filter(c => 
        c.nome.toLowerCase().includes(texto) ||
        c.fiscal.toLowerCase().includes(texto) ||
        (c.fiscal_substituto && c.fiscal_substituto.toLowerCase().includes(texto)) ||
        c.membros.join(" ").toLowerCase().includes(texto)
    );

    atualizarTabela(filtrados);
}

function limparCampos() {
    document.getElementById("nomeComissao").value = "";
    document.getElementById("fiscal").value = "";
    document.getElementById("fiscalSubstituto").value = "";
    document.getElementById("observacao").value = "";

    let container = document.getElementById("membrosContainer");
    container.innerHTML = `<input type="text" class="membro" placeholder="Membro">`;
}

function exportarExcel() {
    let dados = "Comissão;Fiscal;Substituto;Membros;Observação\n";

    comissoes.forEach(c => {
        let substituto = c.fiscal_substituto || "";
        let obs = c.observacao || "";
        dados += `"${c.nome}";"${c.fiscal}";"${substituto}";"${c.membros.join(" - ")}";"${obs}"\n`;
    });

    let blob = new Blob(["\ufeff" + dados], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "comissoes.csv";
    link.click();
}

function atualizarDashboard() {
    document.getElementById("totalComissoes").innerText = comissoes.length;

    let fiscais = new Set();
    let membros = 0;

    comissoes.forEach(c => {
        if(c.fiscal) fiscais.add(c.fiscal);
        if(c.membros) membros += c.membros.length;
    });

    document.getElementById("totalFiscais").innerText = fiscais.size;
    document.getElementById("totalMembros").innerText = membros;
}

// --- MÁSCARAS E FORMATAÇÃO ---
document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && e.target.id !== 'filtro') {
        let inicio = e.target.selectionStart;
        let fim = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(inicio, fim);
    }
});