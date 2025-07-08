import React, { useState, useRef, useEffect } from 'react';

const DigitalWallet = () => {
  const [cards, setCards] = useState([
    {
      id: 1,
      name: "CONAD INSIEME",
      number: "2847 3951 6208 1537",
      type: "FEDELTÀ",
      brand: "CONAD",
      logo: "🛒",
      barcode: "2847395162081537"
    },
    {
      id: 2,
      name: "COOP SOCI",
      number: "8492 1573 9406 2851",
      type: "FEDELTÀ",
      brand: "COOP",
      logo: "🏪",
      barcode: "8492157394062851"
    },
    {
      id: 3,
      name: "ESSELUNGA FIDATY",
      number: "6329 8174 5063 7420",
      type: "PUNTI",
      brand: "ESSELUNGA",
      logo: "🛍️",
      barcode: "6329817450637420"
    }
  ]);

  const [flippedCards, setFlippedCards] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState(null);
  const [scannedData, setScannedData] = useState('');
  const [qrStatus, setQrStatus] = useState('Inquadra il QR code della carta');
  const [notification, setNotification] = useState(null);
  
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);

  const supermarketData = {
    conad: { name: "CONAD", type: "FEDELTÀ", logo: "🛒" },
    coop: { name: "COOP", type: "FEDELTÀ", logo: "🏪" },
    esselunga: { name: "ESSELUNGA", type: "PUNTI", logo: "🛍️" },
    carrefour: { name: "CARREFOUR", type: "FEDELTÀ", logo: "🏬" },
    lidl: { name: "LIDL", type: "SCONTO", logo: "🛒" },
    md: { name: "MD", type: "SCONTO", logo: "🏪" },
    eurospin: { name: "EUROSPIN", type: "SCONTO", logo: "🛍️" },
    altro: { name: "ALTRO", type: "FEDELTÀ", logo: "❓" }
  };

  // Effetto per gestire il cleanup dello scanner
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
    };
  }, []);

  const flipCard = (cardId) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const openAddCardModal = () => {
    setIsModalOpen(true);
    resetModal();
  };

  const closeAddCardModal = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current = null;
    }
    setIsModalOpen(false);
    resetModal();
  };

  const resetModal = () => {
    setCurrentStep(1);
    setSelectedSupermarket(null);
    setScannedData('');
    setQrStatus('Inquadra il QR code della carta');
  };

  const nextStep = () => {
    if (currentStep < 3) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      
      if (newStep === 2) {
        startQRScanner();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      if (currentStep === 2 && qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current = null;
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const startQRScanner = () => {
    // Simulazione scanner QR (in un'app reale useresti una libreria come qr-scanner)
    setTimeout(() => {
      const simulatedQRData = Math.random().toString().slice(2, 18);
      setScannedData(simulatedQRData);
      setQrStatus('✅ QR Code scansionato con successo!');
    }, 2000);
  };

  const saveCard = () => {
    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;
    
    const newCard = {
      id: Date.now(),
      name: `${marketData.name} ${marketData.type}`,
      number: formattedNumber,
      type: marketData.type,
      brand: marketData.name,
      logo: marketData.logo,
      barcode: scannedData
    };
    
    setCards(prev => [newCard, ...prev]);
    closeAddCardModal();
    showNotification('✅ Carta aggiunta con successo!', 'success');
  };

  const showNotification = (text:string, type = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const Card = ({ card }) => (
    <div className="card-container" onClick={() => flipCard(card.id)}>
      <div className={`card ${flippedCards.has(card.id) ? 'flipped' : ''}`}>
        <div className="card-face card-front">
          <div className="card-header">
            <div className="card-logo">{card.logo}</div>
            <div className="card-type">{card.type}</div>
          </div>
          <div className="card-chip"></div>
          <div className="card-number">{card.number}</div>
          <div className="card-footer">
            <div>
              <div className="card-name">{card.name}</div>
              <div className="card-valid">VALIDA FINO 12/26</div>
            </div>
            <div className="card-brand">{card.brand}</div>
          </div>
        </div>
        <div className="card-face card-back">
          <div className="barcode-container">
            <div className="barcode-label">Codice a Barre</div>
            <div className="barcode"></div>
            <div className="barcode-number">{card.barcode}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const EmptyState = () => (
    <div className="empty-state">
      <div className="empty-icon">💳</div>
      <h2 className="empty-title">Nessuna carta aggiunta</h2>
      <p className="empty-description">Inizia aggiungendo la tua prima carta fedeltà</p>
      <button className="btn-empty" onClick={openAddCardModal}>
        <span>+</span>
        Aggiungi Prima Carta
      </button>
    </div>
  );

  const SupermarketSelection = () => (
    <div className="step">
      <div className="form-group">
        <label>Seleziona il Negozio</label>
        <div className="supermarket-grid">
          {Object.entries(supermarketData).map(([key, market]) => (
            <div
              key={key}
              className={`supermarket-option ${selectedSupermarket === key ? 'selected' : ''}`}
              onClick={() => setSelectedSupermarket(key)}
            >
              <div className="supermarket-icon">{market.logo}</div>
              <div className="supermarket-name">{market.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="btn-group">
        <button className="btn btn-secondary" onClick={closeAddCardModal}>
          Annulla
        </button>
        <button 
          className="btn btn-primary" 
          onClick={nextStep}
          disabled={!selectedSupermarket}
        >
          Continua
        </button>
      </div>
    </div>
  );

  const QRScanner = () => (
    <div className="step">
      <div className="qr-scanner-container">
        <div className="qr-scanner-placeholder">
          <div className="qr-overlay"></div>
          <div className="scanner-text">📷 Scanner QR Simulato</div>
        </div>
      </div>
      <div className="qr-status" style={{ color: scannedData ? '#4CAF50' : '#666' }}>
        {qrStatus}
      </div>
      <div className="btn-group">
        <button className="btn btn-secondary" onClick={prevStep}>
          Indietro
        </button>
        <button 
          className="btn btn-primary" 
          onClick={nextStep}
          disabled={!scannedData}
        >
          Continua
        </button>
      </div>
    </div>
  );

  const ConfirmationStep = () => {
    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;

    return (
      <div className="step">
        <div className="form-group">
          <label>Nome Carta</label>
          <input 
            type="text" 
            value={`${marketData?.name} ${marketData?.type}`} 
            readOnly 
          />
        </div>
        <div className="form-group">
          <label>Numero Carta</label>
          <input 
            type="text" 
            value={formattedNumber} 
            readOnly 
          />
        </div>
        <div className="form-group">
          <label>Tipo</label>
          <input 
            type="text" 
            value={marketData?.type} 
            readOnly 
          />
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={prevStep}>
            Indietro
          </button>
          <button className="btn btn-primary" onClick={saveCard}>
            Salva Carta
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .app-header {
          background: linear-gradient(50deg, #536DFE 0%, #663EF3 100%);
          color: white;
          padding: 30px 20px;
          box-shadow: 0 4px 20px rgba(102, 62, 243, 0.2);
        }

        .app-title {
          font-size: 32px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 10px;
        }

        .app-subtitle {
          text-align: center;
          opacity: 0.9;
          font-size: 18px;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 30px;
          margin-top: 20px;
        }

        .card-container {
          position: relative;
          width: 100%;
          height: 220px;
          perspective: 1000px;
        }

        .card {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 20px;
          cursor: pointer;
          transform-style: preserve-3d;
          transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 15px 35px rgba(102, 62, 243, 0.25);
        }

        .card.flipped {
          transform: rotateY(180deg);
        }

        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 20px;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 25px;
          overflow: hidden;
        }

        .card-front {
          background: linear-gradient(135deg, #536DFE 0%, #663EF3 100%);
          color: white;
          transform: rotateY(0deg);
        }

        .card-back {
          background: linear-gradient(135deg, #2c2c54 0%, #1a1a2e 100%);
          color: white;
          transform: rotateY(180deg);
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .card-front::before,
        .card-back::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.05"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.05"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          pointer-events: none;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 2;
          position: relative;
        }

        .card-logo {
          font-size: 32px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .card-type {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.9;
          background: rgba(255,255,255,0.2);
          padding: 6px 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .card-chip {
          width: 45px;
          height: 35px;
          background: linear-gradient(145deg, #ffd700, #ffed4e);
          border-radius: 8px;
          margin: 20px 0;
          position: relative;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
          z-index: 2;
        }

        .card-chip::before {
          content: '';
          position: absolute;
          top: 4px;
          left: 4px;
          right: 4px;
          bottom: 4px;
          background: linear-gradient(45deg, #ffd700, #ffed4e);
          border-radius: 4px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }

        .card-number {
          font-family: 'Courier New', monospace;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 4px;
          margin: 15px 0;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          z-index: 2;
          position: relative;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          z-index: 2;
          position: relative;
        }

        .card-name {
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }

        .card-valid {
          font-size: 11px;
          opacity: 0.8;
        }

        .card-brand {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #ff6b35;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .barcode-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 20px;
        }

        .barcode {
          width: 280px;
          height: 80px;
          background: linear-gradient(90deg, 
            #000 0%, #000 2%, #fff 2%, #fff 4%,
            #000 4%, #000 6%, #fff 6%, #fff 8%,
            #000 8%, #000 10%, #fff 10%, #fff 12%,
            #000 12%, #000 15%, #fff 15%, #fff 17%,
            #000 17%, #000 19%, #fff 19%, #fff 21%,
            #000 21%, #000 23%, #fff 23%, #fff 25%,
            #000 25%, #000 27%, #fff 27%, #fff 29%,
            #000 29%, #000 32%, #fff 32%, #fff 34%,
            #000 34%, #000 36%, #fff 36%, #fff 38%,
            #000 38%, #000 40%, #fff 40%, #fff 42%,
            #000 42%, #000 45%, #fff 45%, #fff 47%,
            #000 47%, #000 49%, #fff 49%, #fff 51%,
            #000 51%, #000 53%, #fff 53%, #fff 55%,
            #000 55%, #000 58%, #fff 58%, #fff 60%,
            #000 60%, #000 62%, #fff 62%, #fff 64%,
            #000 64%, #000 66%, #fff 66%, #fff 68%,
            #000 68%, #000 71%, #fff 71%, #fff 73%,
            #000 73%, #000 75%, #fff 75%, #fff 77%,
            #000 77%, #000 79%, #fff 79%, #fff 81%,
            #000 81%, #000 84%, #fff 84%, #fff 86%,
            #000 86%, #000 88%, #fff 88%, #fff 90%,
            #000 90%, #000 92%, #fff 92%, #fff 94%,
            #000 94%, #000 97%, #fff 97%, #fff 99%,
            #000 99%, #000 100%);
          border-radius: 8px;
          margin: 20px 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .barcode-number {
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: 600;
          margin-top: 15px;
          letter-spacing: 3px;
          color: #fff;
        }

        .barcode-label {
          font-size: 14px;
          opacity: 0.8;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .fab {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(145deg, #ff6b35, #ff8c5a);
          color: white;
          font-size: 28px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 12px 30px rgba(255, 107, 53, 0.4);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fab:hover {
          transform: translateY(-5px) scale(1.1);
          box-shadow: 0 18px 40px rgba(255, 107, 53, 0.6);
        }

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.85);
          z-index: 2000;
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-content {
          background: white;
          padding: 40px;
          border-radius: 25px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.4);
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .modal-title {
          color: #663EF3;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .modal-subtitle {
          color: #666;
          font-size: 16px;
        }

        .step-indicator {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
        }

        .step-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #e9ecef;
          margin: 0 6px;
          transition: all 0.3s ease;
        }

        .step-dot.active {
          background: #663EF3;
          transform: scale(1.3);
          box-shadow: 0 0 10px rgba(102, 62, 243, 0.5);
        }

        .supermarket-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .supermarket-option {
          padding: 25px 15px;
          border: 2px solid #e9ecef;
          border-radius: 15px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: white;
        }

        .supermarket-option:hover {
          border-color: #663EF3;
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(102, 62, 243, 0.2);
        }

        .supermarket-option.selected {
          border-color: #663EF3;
          background: rgba(102, 62, 243, 0.1);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(102, 62, 243, 0.3);
        }

        .supermarket-icon {
          font-size: 36px;
          margin-bottom: 12px;
        }

        .supermarket-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .qr-scanner-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          margin: 20px auto;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .qr-scanner-placeholder {
          width: 100%;
          height: 320px;
          background: linear-gradient(45deg, #1a1a1a, #2a2a2a);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .scanner-text {
          color: white;
          font-size: 18px;
          font-weight: 600;
        }

        .qr-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 220px;
          height: 220px;
          border: 3px solid #ff6b35;
          border-radius: 20px;
          pointer-events: none;
        }

        .qr-overlay::before,
        .qr-overlay::after {
          content: '';
          position: absolute;
          width: 25px;
          height: 25px;
          border: 4px solid #ff6b35;
        }

        .qr-overlay::before {
          top: -4px;
          left: -4px;
          border-right: none;
          border-bottom: none;
          border-radius: 15px 0 0 0;
        }

        .qr-overlay::after {
          bottom: -4px;
          right: -4px;
          border-left: none;
          border-top: none;
          border-radius: 0 0 15px 0;
        }

        .qr-status {
          text-align: center;
          margin-top: 25px;
          font-size: 16px;
          color: #666;
          font-weight: 500;
        }

        .form-group {
          margin-bottom: 25px;
        }

        .form-group label {
          display: block;
          margin-bottom: 10px;
          color: #333;
          font-weight: 600;
          font-size: 16px;
        }

        .form-group input {
          width: 100%;
          padding: 15px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: #fff;
        }

        .form-group input:focus {
          outline: none;
          border-color: #663EF3;
          box-shadow: 0 0 0 4px rgba(102, 62, 243, 0.1);
        }

        .btn-group {
          display: flex;
          gap: 15px;
          margin-top: 30px;
        }

        .btn {
          flex: 1;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(50deg, #536DFE 0%, #663EF3 100%);
          color: white;
        }

        .btn-secondary {
          background: #f8f9fa;
          color: #666;
          border: 2px solid #e9ecef;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #666;
          grid-column: 1 / -1;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #333;
        }

        .empty-description {
          font-size: 16px;
          margin-bottom: 30px;
        }

        .btn-empty {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(50deg, #536DFE 0%, #663EF3 100%);
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-empty:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 62, 243, 0.3);
        }

        .notification {
          position: fixed;
          top: 30px;
          right: 30px;
          background: #4CAF50;
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          z-index: 3000;
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
          animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @media (max-width: 768px) {
          .container {
            padding: 30px 15px;
          }
      `}</style>
      </>
      )
    };