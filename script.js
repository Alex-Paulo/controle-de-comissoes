const banco = supabase.createClient(supabaseUrl, supabaseKey);

// --- SISTEMA DE AUTENTICAÇÃO REAL ---

// 1. Verifica se você já está logado quando abre a página
async function verificarSessao() {
    const { data: { session } } = await banco.auth.getSession();
    
    if (session) {
        // Se já tiver uma sessão ativa, pula o login direto
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        carregarComissoes(); 
    }
}
// Roda a verificação assim que o código carrega
verificarSessao();

// 2. Função de Fazer Login na Nuvem
async function fazerLogin() {
    let emailDigitado = document.getElementById("emailLogin").value;
    let senhaDigitada = document.getElementById("senhaLogin").value;
    let erro = document.getElementById("erroLogin");
    let btnEntrar = document.getElementById("btnEntrar");

    // Mostra que está carregando
    btnEntrar.innerText = "Verificando...";

    // Conecta no Supabase e tenta logar
    const { data, error } = await banco.auth.signInWithPassword({
        email: emailDigitado,
        password: senhaDigitada,
    });

    btnEntrar.innerText = "Entrar"; // Volta o texto ao normal

    if (error) {
        // Se a senha estiver errada
        erro.style.display = "block";
    } else {
        // Se deu certo, entra no sistema
        erro.style.display = "none";
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        carregarComissoes(); 
    }
}

// 3. Função para Sair do Sistema
async function fazerLogout() {
    await banco.auth.signOut();
    
    // Esconde o painel e mostra o login novamente
    document.getElementById("appContent").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    
    // Limpa os campos de senha
    document.getElementById("emailLogin").value = "";
    document.getElementById("senhaLogin").value = "";
}

// Permite dar 'Enter' tanto no campo de email quanto no de senha para logar
document.getElementById("emailLogin").addEventListener("keypress", function(event) {
    if (event.key === "Enter") fazerLogin();
});
document.getElementById("senhaLogin").addEventListener("keypress", function(event) {
    if (event.key === "Enter") fazerLogin();
});


// --- RESTANTE DO SISTEMA ---

let comissoes = [];
let editandoId = null; 

async function carregarComissoes() {
    const { data, error } = await banco.from('comissoes').select('*').order('id', { ascending: true });
    if (error) { console.error("Erro:", error); return; }
    comissoes = data || [];
    atualizarTabela();
    atualizarDashboard();
}

async function salvarComissao() {
    let btnSalvar = document.querySelector('button[onclick="salvarComissao()"]');
    btnSalvar.innerText = "Salvando..."; // Feedback visual de carregamento

    let nome = document.getElementById("nomeComissao").value;
    let fiscal = document.getElementById("fiscal").value;
    let fiscalSiafi = document.getElementById("fiscalSiafi").checked;
    let fiscalCurso = document.getElementById("fiscalCurso").checked;
    let fiscalSubstituto = document.getElementById("fiscalSubstituto").value;
    let substitutoSiafi = document.getElementById("substitutoSiafi").checked;
    let substitutoCurso = document.getElementById("substitutoCurso").checked;
    let obs = document.getElementById("observacao").value;
    let portaria = document.getElementById("portaria").value;
    let boletim = document.getElementById("boletim").value;
    let sigad = document.getElementById("sigad").value;

    // --- LÓGICA DE UPLOAD DA PORTARIA ---
    let inputArquivo = document.getElementById("arquivoPortaria");
    let arquivo = inputArquivo.files[0];
    let caminhoNoStorage = null;

    if (arquivo) {
        // Limpa o nome do arquivo: tira acentos, espaços e caracteres especiais
        const nomeLimpo = arquivo.name
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove os acentos
            .replace(/[^a-zA-Z0-9.-]/g, "_"); // Troca espaços e caracteres estranhos por underline (_)

        const nomeArquivoUnico = `${Date.now()}_${nomeLimpo}`;
        
        const { data, error } = await banco.storage.from('portarias').upload(nomeArquivoUnico, arquivo);
        
        if (error) {
            alert("Erro ao enviar o arquivo PDF: " + error.message);
            btnSalvar.innerText = "Salvar Comissão";
            return; // Interrompe se o upload falhar
        }
        caminhoNoStorage = data.path; // Guarda o caminho para salvar na tabela
    }

    let membrosGroups = document.querySelectorAll(".membro-group");
    let membros = [];

    membrosGroups.forEach(group => {
        let nomeMembro = group.querySelector(".membro-nome").value;
        let siafi = group.querySelector(".membro-siafi").checked;
        let curso = group.querySelector(".membro-curso").checked;
        if(nomeMembro.trim() !== "") {
            membros.push({ nome: nomeMembro, siafi_siasg: siafi, curso: curso });
        }
    });

    let dadosComissao = {
        nome: nome,
        fiscal: fiscal,
        fiscal_siafi: fiscalSiafi,
        fiscal_curso: fiscalCurso,
        fiscal_substituto: fiscalSubstituto,
        substituto_siafi: substitutoSiafi,
        substituto_curso: substitutoCurso,
        membros: membros,
        observacao: obs,
        portaria: portaria,
        boletim: boletim,
        sigad: sigad
    };

    // Só atualiza a coluna do arquivo se um novo arquivo foi enviado
    if (caminhoNoStorage) {
        dadosComissao.arquivo_url = caminhoNoStorage;
    }

    if(editandoId !== null) {
        await banco.from('comissoes').update(dadosComissao).eq('id', editandoId);
        editandoId = null;
    } else {
        await banco.from('comissoes').insert([dadosComissao]);
    }

    limparCampos();
    await carregarComissoes(); 
    btnSalvar.innerText = "Salvar Comissão"; // Retorna o botão ao texto normal
}

// --- FUNÇÃO PARA BAIXAR/ABRIR A PORTARIA ---
async function baixarPortaria(path) {
    const { data, error } = await banco.storage.from('portarias').createSignedUrl(path, 60);
    
    if (error) {
        alert("Erro ao abrir o arquivo: " + error.message);
    } else if (data) {
        window.open(data.signedUrl, '_blank'); // Abre o PDF em uma nova aba
    }
}

async function excluir(id) {
    if(confirm("Deseja excluir esta comissão definitivamente?")) {
        await banco.from('comissoes').delete().eq('id', id);
        await carregarComissoes();
    }
}

function adicionarMembro() {
    let container = document.getElementById("membrosContainer");
    let div = document.createElement("div");
    div.className = "militar-row membro-group"; 
    
    div.innerHTML = `
        <input type="text" class="membro-nome" placeholder="Nome do Membro">
        <div class="checkbox-group">
            <label><input type="checkbox" class="membro-siafi"> SIAFI/SIASG</label>
            <label><input type="checkbox" class="membro-curso"> Tem Curso</label>
        </div>
    `;
    container.appendChild(div);
}

function gerarBadges(temSiafi, temCurso) {
    let badgeSiafi = temSiafi ? '<span class="badge sim">SIAFI</span>' : '<span class="badge nao">SIAFI</span>';
    let badgeCurso = temCurso ? '<span class="badge sim">CURSO</span>' : '<span class="badge nao">CURSO</span>';
    return `<div class="badges-container">${badgeSiafi}${badgeCurso}</div>`;
}

function atualizarTabela(lista = comissoes) {
    let tabela = document.getElementById("listaComissoes");
    tabela.innerHTML = "";

    lista.forEach((c, index) => {
        let fiscalExibicao = `
            <div class="militar-container">
                <span class="militar-nome">${c.fiscal}</span>
                ${gerarBadges(c.fiscal_siafi, c.fiscal_curso)}
            </div>
        `;

        let substitutoExibicao = "-";
        if (c.fiscal_substituto) {
            substitutoExibicao = `
                <div class="militar-container">
                    <span class="militar-nome">${c.fiscal_substituto}</span>
                    ${gerarBadges(c.substituto_siafi, c.substituto_curso)}
                </div>
            `;
        }

        let membrosExibicao = "-";
        if (c.membros && c.membros.length > 0) {
            let listaMembrosHTML = c.membros.map(m => `
                <div class="militar-container">
                    <span class="militar-nome">${m.nome}</span>
                    ${gerarBadges(m.siafi_siasg, m.curso)}
                </div>
            `).join("");
            membrosExibicao = `<div class="membros-lista">${listaMembrosHTML}</div>`;
        }

        let boletimExibicao = c.boletim;
        if (!c.boletim || c.boletim.trim() === "") {
            if (c.created_at) {
                let dataCriacao = new Date(c.created_at);
                let hoje = new Date();
                let diffDias = Math.floor((hoje - dataCriacao) / (1000 * 60 * 60 * 24));
                
                if (diffDias >= 3) {
                    boletimExibicao = `<span style="background-color: #dc3545; color: white; padding: 4px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold; white-space: nowrap;">🚨 ATRASADO</span>`;
                } else {
                    boletimExibicao = `<span style="background-color: #ffc107; color: #000; padding: 4px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold; white-space: nowrap;">⏳ Pendente</span>`;
                }
            } else {
                boletimExibicao = `<span style="background-color: #ffc107; color: #000; padding: 4px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold; white-space: nowrap;">⏳ Pendente</span>`;
            }
        }

        // --- EXIBIÇÃO DA PORTARIA (Apenas texto) ---
        let portariaExibicao = c.portaria || "-";

        // --- LÓGICA DO BOTÃO DE BAIXAR NAS AÇÕES ---
        let botaoBaixar = "";
        if (c.arquivo_url) {
            botaoBaixar = `<button onclick="baixarPortaria('${c.arquivo_url}')" style="background-color: #198754; margin-bottom: 4px;">Baixar PDF</button>`;
        }

        let linha = `
        <tr>
            <td style="vertical-align: top;"><strong>${c.nome}</strong></td>
            <td style="vertical-align: top;">${fiscalExibicao}</td>
            <td style="vertical-align: top;">${substitutoExibicao}</td>
            <td style="vertical-align: top;">${membrosExibicao}</td>
            <td style="vertical-align: top;">${portariaExibicao}</td>
            <td style="vertical-align: top;">${boletimExibicao}</td>
            <td style="vertical-align: top;">${c.sigad || "-"}</td>
            <td style="vertical-align: top;">${c.observacao || "-"}</td>
            <td class="acoes" style="vertical-align: top; min-width: 100px;">
                ${botaoBaixar}
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
    document.getElementById("fiscalSiafi").checked = c.fiscal_siafi;
    document.getElementById("fiscalCurso").checked = c.fiscal_curso;
    document.getElementById("fiscalSubstituto").value = c.fiscal_substituto || "";
    document.getElementById("substitutoSiafi").checked = c.substituto_siafi;
    document.getElementById("substitutoCurso").checked = c.substituto_curso;
    document.getElementById("portaria").value = c.portaria || "";
    document.getElementById("boletim").value = c.boletim || "";
    document.getElementById("sigad").value = c.sigad || "";
    document.getElementById("observacao").value = c.observacao || "";
    document.getElementById("arquivoPortaria").value = ""; // Limpa o input de arquivo ao editar

    let container = document.getElementById("membrosContainer");
    container.innerHTML = ""; 

    if (c.membros && c.membros.length > 0) {
        c.membros.forEach(m => {
            let div = document.createElement("div");
            div.className = "militar-row membro-group";
            div.innerHTML = `
                <input type="text" class="membro-nome" value="${m.nome}">
                <div class="checkbox-group">
                    <label><input type="checkbox" class="membro-siafi" ${m.siafi_siasg ? 'checked' : ''}> SIAFI/SIASG</label>
                    <label><input type="checkbox" class="membro-curso" ${m.curso ? 'checked' : ''}> Tem Curso</label>
                </div>
            `;
            container.appendChild(div);
        });
    } else {
        adicionarMembro(); 
    }
    editandoId = c.id; 
}

function limparCampos() {
    document.getElementById("nomeComissao").value = "";
    document.getElementById("fiscal").value = "";
    document.getElementById("fiscalSiafi").checked = false;
    document.getElementById("fiscalCurso").checked = false;
    document.getElementById("fiscalSubstituto").value = "";
    document.getElementById("substitutoSiafi").checked = false;
    document.getElementById("substitutoCurso").checked = false;
    document.getElementById("portaria").value = "";
    document.getElementById("boletim").value = "";
    document.getElementById("sigad").value = "";
    document.getElementById("observacao").value = "";
    document.getElementById("arquivoPortaria").value = ""; // Limpa o campo do arquivo
    
    let container = document.getElementById("membrosContainer");
    container.innerHTML = "";
    adicionarMembro();
}

function filtrar() {
    let texto = document.getElementById("filtro").value.toLowerCase();
    let filtrados = comissoes.filter(c => 
        c.nome.toLowerCase().includes(texto) ||
        c.fiscal.toLowerCase().includes(texto) ||
        (c.fiscal_substituto && c.fiscal_substituto.toLowerCase().includes(texto)) ||
        (c.membros && c.membros.some(m => m.nome.toLowerCase().includes(texto))) ||
        (c.portaria && c.portaria.toLowerCase().includes(texto)) ||
        (c.boletim && c.boletim.toLowerCase().includes(texto)) ||
        (c.sigad && c.sigad.toLowerCase().includes(texto))
    );
    atualizarTabela(filtrados);
}

function exportarExcel() {
    let dados = "Comissão;Fiscal;Substituto;Membros;Portaria;Boletim;SIGAD;Observação\n";
    comissoes.forEach(c => {
        let qualFiscal = `(SIAFI: ${c.fiscal_siafi ? 'Sim' : 'Nao'} | Curso: ${c.fiscal_curso ? 'Sim' : 'Nao'})`;
        let fiscalExp = `${c.fiscal} ${qualFiscal}`;
        let subExp = "";
        if (c.fiscal_substituto) {
            let qualSub = `(SIAFI: ${c.substituto_siafi ? 'Sim' : 'Nao'} | Curso: ${c.substituto_curso ? 'Sim' : 'Nao'})`;
            subExp = `${c.fiscal_substituto} ${qualSub}`;
        }
        let membrosExp = "";
        if (c.membros && c.membros.length > 0) {
            membrosExp = c.membros.map(m => `${m.nome} (SIAFI: ${m.siafi_siasg ? 'Sim' : 'Nao'} | Curso: ${m.curso ? 'Sim' : 'Nao'})`).join(" - ");
        }
        let portaria = c.portaria || "";
        let boletim = c.boletim || "Pendente"; 
        let sigad = c.sigad || "";
        let obs = c.observacao || "";
        dados += `"${c.nome}";"${fiscalExp}";"${subExp}";"${membrosExp}";"${portaria}";"${boletim}";"${sigad}";"${obs}"\n`;
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
    let membrosCount = 0;
    comissoes.forEach(c => {
        if(c.fiscal) fiscais.add(c.fiscal);
        if(c.membros) membrosCount += c.membros.length;
    });
    document.getElementById("totalFiscais").innerText = fiscais.size;
    document.getElementById("totalMembros").innerText = membrosCount;
}

document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && e.target.id !== 'filtro') {
        let inicio = e.target.selectionStart;
        let fim = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(inicio, fim);
    }
});