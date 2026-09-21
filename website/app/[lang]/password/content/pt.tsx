import type { Metadata } from "next";
import { OG_LOCALES, getLanguageAlternates, getLocalizedUrl } from "@/app/i18n";
import { CopyButton } from "@/app/components/CopyButton";
import DocsNavbarComponent from "@/app/components/DocsNavbarComponent";
import DocsSidebarComponent from "@/app/components/DocsSidebarComponent";
import DocTableOfContentComponent from "@/app/components/DocTableOfContentComponent";

export const metadata: Metadata = {
  title: "Redefinir senha - Documentação do Databasus",
  description:
    "Aprenda a redefinir senhas de usuários no Databasus com a ferramenta de linha de comando integrada. Recuperação de senha rápida e segura para o seu sistema de backup PostgreSQL.",
  keywords: [
    "redefinir senha Databasus",
    "redefinir senha de usuário",
    "senha de backup PostgreSQL",
    "recuperação de senha no Docker",
    "recuperação de senha",
    "autenticação Databasus",
  ],
  openGraph: {
    title: "Redefinir senha - Documentação do Databasus",
    description:
      "Aprenda a redefinir senhas de usuários no Databasus com a ferramenta de linha de comando integrada. Recuperação de senha rápida e segura para o seu sistema de backup PostgreSQL.",
    type: "article",
    url: getLocalizedUrl("pt", "password"),
    locale: OG_LOCALES.pt,
  },
  twitter: {
    card: "summary",
    title: "Redefinir senha - Documentação do Databasus",
    description:
      "Aprenda a redefinir senhas de usuários no Databasus com a ferramenta de linha de comando integrada. Recuperação de senha rápida e segura para o seu sistema de backup PostgreSQL.",
  },
  alternates: {
    canonical: getLocalizedUrl("pt", "password"),
    languages: getLanguageAlternates("password"),
  },
  robots: "index, follow",
};

export default function PasswordResetPage() {
  const resetPasswordCommand = `docker exec -it databasus ./main --new-password="YourNewSecurePassword123" --email="owner@example.com"`;
  const listAdminsCommand = `docker exec -it databasus ./main --list-admins`;
  const disableTwoFactorCommand = `docker exec -it databasus ./main --disable-2fa`;

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: "Redefinir senha - Documentação do Databasus",
            description:
              "Aprenda a redefinir senhas de usuários no Databasus com a ferramenta de linha de comando integrada.",
            author: {
              "@type": "Organization",
              name: "Databasus",
            },
            publisher: {
              "@type": "Organization",
              name: "Databasus",
              logo: {
                "@type": "ImageObject",
                url: "https://databasus.com/logo.svg",
              },
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Como redefinir a senha de um usuário do Databasus",
            description:
              "Guia passo a passo para redefinir senhas de usuários no Databasus",
            step: [
              {
                "@type": "HowToStep",
                name: "Execute o comando de redefinição de senha",
                text: "Execute o comando docker exec com a nova senha e o email do usuário.",
                itemListElement: [
                  {
                    "@type": "HowToDirection",
                    text: "Use docker exec para executar o comando de redefinição de senha dentro do container do Databasus",
                  },
                ],
              },
              {
                "@type": "HowToStep",
                name: "Verifique a alteração da senha",
                text: "Faça login no Databasus com a nova senha para confirmar que a alteração foi bem-sucedida.",
              },
            ],
          }),
        }}
      />

      <DocsNavbarComponent lang="pt" />

      <div className="flex min-h-screen bg-[#0F1115]">
        {/* Sidebar */}
        <DocsSidebarComponent lang="pt" />

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-12">
          <div className="mx-auto max-w-4xl">
            <article className="prose prose-blue max-w-none">
              <h1 id="reset-password">Redefinir a senha de um usuário</h1>

              <h2 id="reset-password-command">
                Comando de redefinição de senha
              </h2>

              <p>
                Para redefinir a senha de um usuário, use o seguinte comando no
                servidor onde o Databasus está rodando:
              </p>

              <div className="relative my-6">
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                  <code>{resetPasswordCommand}</code>
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={resetPasswordCommand} lang="pt" />
                </div>
              </div>

              <h2 id="parameters">Parâmetros</h2>

              <p>O comando aceita os seguintes parâmetros:</p>

              <ul>
                <li>
                  <strong>--new-password</strong>: a nova senha. Garanta que é
                  segura e contém uma mistura de letras, números e caracteres
                  especiais.
                </li>
                <li>
                  <strong>--email</strong>: o endereço de email da conta cuja
                  senha você quer redefinir (por exemplo,{" "}
                  <code>owner@example.com</code>). Uma instância criada antes de
                  a primeira conta administrá-la ainda carrega o endereço
                  provisório <code>admin</code> até que seu dono o substitua,
                  então informe <code>admin</code> nesse caso.
                </li>
              </ul>

              <h2 id="list-admins">Listar as contas de administrador</h2>

              <p>
                Se você não lembra qual endereço administra a instância, liste
                as contas de administrador no servidor onde o Databasus está em
                execução:
              </p>

              <div className="relative my-6">
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                  <code>{listAdminsCommand}</code>
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={listAdminsCommand} lang="pt" />
                </div>
              </div>

              <p>
                A saída nomeia cada conta de administrador com seu endereço de
                email, nome de exibição, data de criação e estado de atividade,
                e marca aquela que a instância reconhece como seu administrador.
                Nenhuma senha, hash de senha ou token é impresso. Em uma
                instância onde ninguém criou uma conta ainda, ela informa que a
                instância não tem administrador.
              </p>
              <h2 id="disable-two-factor">
                Parar de pedir um código no login
              </h2>

              <p>
                Uma instância pode exigir, além da senha, um código de seis
                dígitos enviado por e-mail no login. Se o servidor de e-mail
                parar de entregar esses códigos, ninguém entra com senha, e
                redefinir a senha sozinho não resolve. Desligue o segundo fator
                no servidor onde o Databasus está em execução:
              </p>

              <div className="relative my-6">
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                  <code>{disableTwoFactorCommand}</code>
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={disableTwoFactorCommand} />
                </div>
              </div>

              <p>
                O comando informa se mudou alguma coisa, termina sem reclamar
                quando o segundo fator já está desligado e registra a mudança no
                log de auditoria. O próximo login por senha dispensa o código, e
                um administrador pode ligar a opção de novo assim que o e-mail
                voltar a funcionar.
              </p>
            </article>
          </div>
        </main>

        {/* Table of Contents */}
        <DocTableOfContentComponent />
      </div>
    </>
  );
}
