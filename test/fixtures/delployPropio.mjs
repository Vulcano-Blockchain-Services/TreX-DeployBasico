import OnchainID from '@onchain-id/solidity';




const deployIdentityProxy = async(implementationAuthority, managementKey, signer) => {
    const identity = await new ethers.ContractFactory(OnchainID.contracts.IdentityProxy.abi, OnchainID.contracts.IdentityProxy.bytecode, signer).deploy(
      implementationAuthority,
      managementKey,
    );
  
    return ethers.getContractAt('Identity', identity.address, signer);
  }

const inicio = async() => {
    const [deployer,tokenIssuer,acc1,acc2,acc3,acc4,acc5,tokenAggent] = await ethers.getSigners();

    /*
    Estructura de los contrato:
    Esta el contrato Token.sol donde esta toda la logica del token mismo
    Esta identityRegistry.sol el cual llama a las funcoines de identityRegistryStorage el cual guarda los datos

    */


    /*
    COMENTARIO TOKEN.SOL (TRX TOKEN)
    Todas las funciones de siempre pero con las siguientes funciones extra:
    onchainID() Devuelve el address de onChainID
    version() Devuelve version de trx token
    identityRegistry() Devuelve contrato de registro de identidad
    compliance() Devuelve al direccion del contrato compilance
    isFrozen(_wallet) True la wallet esta frozeada
    getFrozenTokens(_wallet) Devuelve la cantidad de tokens frozeados
    setOnchainID(_address) Seteas el onChainId
    setAddressFrozen(_wallet, bool) Frozeas a una wallet con true
    freezePartialTokens(_wallet, _cantidad) Frozeas una cantidad de tokens de cierta wallet
    unfreezePartialTokens(_wallet,_cantidad) Desfrozeas una cantidad de tokens a cierta wallet
    setIdentityRegistry(_address) Cambias la direccion de identityRegistry
    setCompliance(_address) Seteas el contrato compilance
    forcedTransfer(_from, _to, _cantidad) Transifere de forma forzosa cierta cantidad
    recoveryAddress(_lostwallet, _newWallet, _investorChainId) Recupera wallet

    Extra
    Tambien se puede hacer deploy de un contrato externo llamado AgenteManager.sol el cual si le damos poder de agente puede controlar muchas funciones

    */

    //Deploys contratos
    const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);
    const trustedIssuersRegistry = await ethers.deployContract('TrustedIssuersRegistry', deployer);
    const claimTopicsRegistry = await ethers.deployContract('ClaimTopicsRegistry', deployer);
    const identityRegistryStorage = await ethers.deployContract('IdentityRegistryStorage', deployer);
    const defaultCompliance = await ethers.deployContract('DefaultCompliance', deployer);
    const tokenImplementation = await ethers.deployContract('Token', deployer);

    //Deploy contratos identidades onChainId (REVISAR)
    const identityImplementation = await new ethers.ContractFactory(
        OnchainID.contracts.Identity.abi,
        OnchainID.contracts.Identity.bytecode,
        deployer,
      ).deploy(deployer.address, true);
    const identityImplementationAuthority = await new ethers.ContractFactory(
        OnchainID.contracts.ImplementationAuthority.abi,
        OnchainID.contracts.ImplementationAuthority.bytecode,
        deployer,
      ).deploy(identityImplementation.address);
    const tokenOID = await deployIdentityProxy(identityImplementationAuthority.address, tokenIssuer.address, deployer);


    //Inicializamos el contrato Token.sol
    await tokenImplementation.connect(deployer).init(
        identityRegistryImplementation.address,
        defaultCompliance.address,
        "Vulcano Services",
        "Vul",
        18,
        tokenOID.address
    );
    
    //Inicializamos contrato identityRegistry.sol
    await identityRegistryImplementation.connect(deployer).init(trustedIssuersRegistry.address,claimTopicsRegistry.address,identityRegistryStorage.address)
    
    //Inicizalizamos contrato IdentityRegistryStorage.sol
    await identityRegistryStorage.connect(deployer).init();

    //Agregamos agente tokenAggent en el contrato Token
    await tokenImplementation.connect(deployer).addAgent(tokenAggent.address);

    //Agregamos agente en identityRegistery a tokenAggent
    await identityRegistryImplementation.connect(deployer).addAgent(tokenAggent.address);

    //Agregamos agente en identityRegisteryStorage a tokenAggent
    await identityRegistryStorage.connect(deployer).addAgent(tokenAggent.address);
   // await identityRegistryImplementation.connect(deployer).addAgent(tokenImplementation.address);
    
    //Enlazamos el contrtao de identityRegistry con identityRegistryStorage
    await identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistryImplementation.address);

    //Creamos un contrato de identidad a la acc1, acc2 y acc3 (REVISAR)
    const acc1Identity = await deployIdentityProxy(identityImplementationAuthority.address, acc1.address, deployer);
    const acc2Identity = await deployIdentityProxy(identityImplementationAuthority.address, acc2.address, deployer);
    const acc3Identity = await deployIdentityProxy(identityImplementationAuthority.address, acc3.address, deployer);

    //Registramos identidad a acc1 y acc2
    await identityRegistryImplementation.connect(tokenAggent).registerIdentity(acc1.address,acc1Identity.address,1);
    await identityRegistryImplementation.connect(tokenAggent).registerIdentity(acc2.address,acc2Identity.address,1);
    await identityRegistryImplementation.connect(tokenAggent).registerIdentity(acc3.address,acc3Identity.address,1);

    //Minteamos con exito toksn a la identidad acc1
    await tokenImplementation.connect(tokenAggent).mint(acc1.address, 100)
    
    //Despausamos el contrato
    await tokenImplementation.connect(tokenAggent).unpause()

    //El agente regulador desconfia de la wallet acc2 y la forzea
    await tokenImplementation.connect(tokenAggent).setAddressFrozen(acc2.address, true)
    
    try {
      await tokenImplementation.connect(acc1).transfer(acc2.address, 50);
    } catch (error) {
      console.error("Error esperado: Intenta acc1 enviar 50 tokens a acc2 pero da error porque esta forzeado");
    }
    
    //El agente reviso a acc2 y ve que esta todo bien para luego desforzearlo
    await tokenImplementation.connect(tokenAggent).setAddressFrozen(acc2.address, false)
    
    //Transfiere acc1 a acc2 para poder hacer esto fue necesesario despausar el contrato y registrar a acc2 y desfozearlo
    await tokenImplementation.connect(acc1).transfer(acc2.address, 50);
    
    await tokenImplementation.connect(tokenAggent).recoveryAddress(acc2.address, acc3.address,acc2Identity.address)
    



    console.log("Todo correcto!!!!")
    }
    inicio()