# Como Testar no Celular

Para testar o jogo no seu celular, siga os passos abaixo:

1. **Conectar na mesma rede Wi-Fi**: Certifique-se de que seu celular e seu computador estejam conectados à mesma rede Wi-Fi.

2. **Descobrir o IP do Computador**:
   O sistema detectou seu IP local como: **192.168.3.194**

3. **Acessar no Navegador do Celular**:
   Abra o Chrome ou Safari no seu celular e digite o seguinte endereço:
   
   **http://192.168.3.194:5173**

   _(Nota: A porta padrão do Vite é 5173. Se o terminal mostrar outra porta, use a que aparecer lá)_

4. **Solução de Problemas**:
   - Se a página não carregar, verifique se o firewall do seu computador não está bloqueando a conexão.
   - Certifique-se de que o comando `npm run dev` está rodando no terminal do computador.

### Mudanças Realizadas no Gameplay

- **Escala de Poder**: O dano (XP) que você causa agora escala com a Arena.
  - Arena 1: 1x (Dano Normal)
  - Arena 2: 4x
  - Arena 3: 9x
  - Arena 4: 16x
  - Arena 5: 25x (Isso ajudará a derrubar a barra de vida enorme do Lorde Silêncio!)
