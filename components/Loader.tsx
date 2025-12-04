import React from 'react';
import styled from 'styled-components';

const Loader = () => {
  return (
    <StyledWrapper>
      <div className="wrapper">
        <div className="circle" />
        <div className="circle" />
        <div className="circle" />
        <div className="shadow" />
        <div className="shadow" />
        <div className="shadow" />
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .wrapper {
    width: 200px;
    height: 60px;
    position: relative;
    z-index: 1;
  }

  .circle {
    width: 20px;
    height: 20px;
    position: absolute;
    border-radius: 50%;
    background-color: #2D9CDB;
    left: 15%;
    transform-origin: 50%;
    animation: circle7124 .5s alternate infinite ease;
  }

  @keyframes circle7124 {
    0% {
      top: 60px;
      height: 5px;
      border-radius: 50px 50px 25px 25px;
      transform: scaleX(1.7);
    }

    40% {
      height: 20px;
      border-radius: 50%;
      transform: scaleX(1);
    }

    100% {
      top: 0%;
    }
  }

  .circle:nth-child(2) {
    left: 45%;
    animation-delay: .2s;
    background-color: #56CCF2;
  }

  .circle:nth-child(3) {
    left: auto;
    right: 15%;
    animation-delay: .3s;
    background-color: #A78BFA;
  }

  .shadow {
    width: 20px;
    height: 4px;
    border-radius: 50%;
    background-color: rgba(45, 156, 219, 0.3);
    position: absolute;
    top: 62px;
    transform-origin: 50%;
    z-index: -1;
    left: 15%;
    filter: blur(1px);
    animation: shadow046 .5s alternate infinite ease;
  }

  @keyframes shadow046 {
    0% {
      transform: scaleX(1.5);
    }

    40% {
      transform: scaleX(1);
      opacity: .7;
    }

    100% {
      transform: scaleX(.2);
      opacity: .4;
    }
  }

  .shadow:nth-child(4) {
    left: 45%;
    animation-delay: .2s;
    background-color: rgba(86, 204, 242, 0.3);
  }

  .shadow:nth-child(5) {
    left: auto;
    right: 15%;
    animation-delay: .3s;
    background-color: rgba(167, 139, 250, 0.3);
  }
`;

export default Loader;
