import React, { useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial, BakeShadows, Text, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField, Glitch } from '@react-three/postprocessing'
import { GlitchMode } from 'postprocessing'

import { easing } from 'maath'

export default function App() {
  return (
    <Canvas shadows dpr={[1.5, 1.5]} camera={{ position: [0, 0, 0], fov: 70, near: 1, far: 20 }} eventSource={document.getElementById('root')} eventPrefix="client">
      <color attach="background" args={['black']} />
      <hemisphereLight intensity={0.15} groundColor="white" />
      <spotLight position={[10, 20, 10]} angle={0.01} penumbra={1} intensity={1} castShadow shadow-mapSize={720} />
      <group position={[-0, -1, 0]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <MeshReflectorMaterial
            blur={[10, 5]}
            resolution={2048}
            mixBlur={0.1}
            mixStrength={80}
            roughness={1}
            depthScale={0}
            minDepthThreshold={0}
            maxDepthThreshold={0}
            color="#202020"
            metalness={0.8}
          />
        </mesh>
        <pointLight distance={1.5} intensity={1} position={[-0.15, 0.7, 0]} color="orange" />
        <FormInput />
      </group>
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0} mipmapBlur luminanceSmoothing={0.1} intensity={4} />
        <DepthOfField target={[0, 0, 13]} focalLength={0.5} bokehScale={0.5} height={1000} />
      </EffectComposer>
      <CameraRig />
      <BakeShadows />
    </Canvas>
  )
}

function formatShortDate(date) {
  let formattedTime = '00:00'
  if (date) {
    const toFormatDate = date + ''
    const splitDate = toFormatDate.split(' ')[1]
    formattedTime = splitDate.split('.')[0]
  }
  return formattedTime
}

function formatDateToText(inputDate) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  const parsedDate = new Date(inputDate)

  const dayIndex = parsedDate.getDay()
  const dayName = days[dayIndex]
  const date = parsedDate.getDate()
  const monthIndex = parsedDate.getMonth()
  const monthName = months[monthIndex]
  const year = parsedDate.getFullYear()

  const formattedDate = `${dayName}, ${date} ${monthName} ${year}`

  return formattedDate
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)

  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  const formattedDate = `${year}-${month}-${day}`

  return formattedDate
}

function calculateWorkHour(dateTime1, dateTime2) {
  try {
    const date1 = new Date(dateTime1)
    const date2 = new Date(dateTime2)
    const diffInMilliseconds = Math.abs(date2 - date1)
    const diffInMinutes = Math.abs(diffInMilliseconds / (1000 * 60))
    const hours = Math.floor(diffInMinutes / 60)
    const minutes = Math.abs(diffInMinutes % 60)
    return hours + minutes / 60
  } catch (error) {
    return 0
  }
}

function timestampToDecimal(timestamp) {
  const dateTimeParts = timestamp.split(' ')
  if (dateTimeParts.length === 2) {
    const timeParts = dateTimeParts[1].split(':')
    if (timeParts.length === 3) {
      const hours = parseInt(timeParts[0])
      const minutes = parseInt(timeParts[1])
      const seconds = parseInt(timeParts[2])
      return hours + Math.round(minutes) / 60 + seconds / 3600
    }
  }
  return null
}

function decimalToTime(decimalHours) {
  decimalHours = Number(decimalHours)

  var hours = Math.floor(decimalHours)
  var remainingMinutes = Math.floor((decimalHours - hours) * 60)

  if (remainingMinutes === 60) {
    hours += 1
    remainingMinutes = 0
  }

  var formattedTime = (hours < 10 ? '0' : '') + hours + ':' + (remainingMinutes < 10 ? '0' : '') + remainingMinutes

  return formattedTime
}

function estimateFinishedWorkHour(rawData, defaultWorkhour, breakTime) {
  const filteredData = rawData.filter((item) => item.type === 'IN' || item.type === 'OUT')

  const totalWorkHour = calculateTotalWorkHours(filteredData, breakTime)

  const lastInEntry = filteredData.filter((item) => item.type === 'IN').reduce((latest, current) => (latest.dateTime > current.dateTime ? latest : current), { dateTime: 0 })
  const isOnlytwo = filteredData.length <= 2 ? true : false
  const decimalBreakTime = parseFloat(breakTime) / 100

  if (lastInEntry.dateTime && totalWorkHour <= defaultWorkhour) {
    const timeSinceLastIn = timestampToDecimal(lastInEntry.dateTime)
    const estimatedFinishedHour = isOnlytwo
      ? decimalBreakTime + Math.abs(defaultWorkhour) - Math.abs(totalWorkHour) + Math.abs(timeSinceLastIn)
      : Math.abs(defaultWorkhour) - Math.abs(totalWorkHour) + Math.abs(timeSinceLastIn)
    return decimalToTime(estimatedFinishedHour)
  } else {
    return decimalToTime(0)
  }
}

function calculateTotalWorkHours(rawData, breakTime) {
  const [totalHours, setTotalHours] = useState(0)

  useEffect(() => {
    const filteredData = rawData.filter((item) => item.type === 'IN' || item.type === 'OUT')

    if (filteredData.length === 2 && filteredData[0].type === 'IN' && filteredData[1].type === 'OUT') {
      const workHour = calculateWorkHour(filteredData[0].dateTime, filteredData[1].dateTime)
      setTotalHours(workHour - breakTime / 60)
    } else {
      let localTotalHours = 0
      let localParkInIndex = -1

      for (let i = 0; i < filteredData.length; i++) {
        const type = filteredData[i].type

        if (type === 'IN') {
          localParkInIndex = i
        } else if (type === 'OUT' && localParkInIndex !== -1) {
          const workHour = calculateWorkHour(filteredData[localParkInIndex].dateTime, filteredData[i].dateTime)
          localTotalHours += workHour

          localParkInIndex = -1
        }
      }

      setTotalHours(localTotalHours)
    }
  }, [rawData, breakTime])
  return totalHours
}

function formatDate(inputDate) {
  const date = new Date(inputDate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRandomUniqueIndices(total, count) {
  if (count >= total) return Array.from({ length: total }, (_, i) => i)
  const indices = new Set()
  while (indices.size < count) {
    const index = Math.floor(Math.random() * total)
    indices.add(index)
  }
  return Array.from(indices)
}

function CameraRig() {
  useFrame((state, delta) => {
    easing.damp3(state.camera.position, [0 + (state.pointer.x * state.viewport.width) / 100, state.pointer.y / -20, 6.5], 1, delta)
    state.camera.lookAt(0, 0, 0)
  })
}

function FormInput() {
  const [inputText, setInputText] = useState('')

  const handleKeyDown = (event) => {
    const character = event.key
    if (/^[a-zA-Z\s]$/.test(character)) {
      setInputText((prevText) => prevText + character.toUpperCase())
    } else if (event.key === 'Backspace') {
      setInputText((prevText) => prevText.slice(0, -1))
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <group>
      <ThreeDText position={[0, 4.2, -5]} text={inputText} />
      <TypeSomething position={[0, 4.2, -5]} text={inputText} />
      <FetchEmployeeData inputText={inputText} />
    </group>
  )

  function FetchEmployeeData({ inputText }) {
    const [employeeData, setEmployeeData] = useState([])
    const numPositions = 1

    useEffect(() => {
      async function fetchData() {
        if (inputText.length > 3) {
          const response = await fetch('http://10.250.0.229:666/hris-api/employee/get?name=' + inputText)
          const res = response.status
          let data = []
          if (res === 200) {
            data = await response.json()
          }
          setEmployeeData(data)
        } else {
          setEmployeeData([])
        }
      }

      fetchData()
    }, [inputText])

    const positions = getRandomUniqueIndices(numPositions, employeeData.length)

    if (employeeData.length > 0 && employeeData.length < 2) {
      return (
        <group>
          {employeeData.map((employee, index) => (
            <LayedThreeDText key={index} position={[0, 5 + index, -5]} text={employee.fullName} />
          ))}
        </group>
      )
    } else {
      return (
        <group>
          <LayedThreeDText position={[0, 0, 0]} text="" />
          {!inputText || inputText === '' ? (
            <>
              <TitleText />
            </>
          ) : null}
        </group>
      )
    }
  }

  function calculatePosition(index, totalPositions) {
    const distance = 1.2
    const verticalSpacing = 0.5

    const x = 0
    const y = 0.3
    const z = 1 + -index * verticalSpacing

    return [x, y, z]
  }
}

function TitleText() {
  return (
    <group>
      <Text font="/Inter-Medium.woff" fontSize={2} position={[0, 1.7, 0]} textAlign="center" color="#F89A36">
        RAW SIK DATA
      </Text>
      <Text font="/Inter-Medium.woff" fontSize={0.3} position={[0, 0.5, 0]} textAlign="center">
        real time in-office attendance activity
      </Text>
    </group>
  )
}

function LayedThreeDText({ position, text }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isLeftHovered, setIsLeftHovered] = useState(false)
  const [isRightHovered, setIsRightHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [responseStatus, setResponseStatus] = useState(null)
  const [data, setData] = useState([])
  const today = new Date()
  const [filteredDate, setFilteredDate] = useState(formatDate(today))

  const color = isHovered ? 'yellow' : '#F89A36'
  const leftColor = isLeftHovered ? 'pink' : 'white'
  const rightColor = isRightHovered ? 'skyblue' : 'white'

  const handleArrowButton = async (event) => {
    const arrow = event.key

    if (arrow === 'ArrowLeft') {
      const previousDate = new Date(filteredDate)
      previousDate.setDate(previousDate.getDate() - 1)
      const newFilteredDate = formatTimestamp(previousDate)
      setFilteredDate(newFilteredDate)
      try {
        await fetchRawData(newFilteredDate)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    } else if (arrow === 'ArrowRight') {
      const nextDateButton = new Date(filteredDate)
      nextDateButton.setDate(nextDateButton.getDate() + 1)
      const newFilteredDate = formatTimestamp(nextDateButton)
      setFilteredDate(newFilteredDate)
      try {
        await fetchRawData(newFilteredDate)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleArrowButton)
    return () => {
      window.removeEventListener('keydown', handleArrowButton)
    }
  }, [filteredDate])

  const handleLeftButtonClick = async () => {
    const prevDate = new Date(filteredDate)
    prevDate.setDate(prevDate.getDate() - 1)
    const newFilteredDate = formatTimestamp(prevDate)
    setFilteredDate(newFilteredDate)
    await fetchRawData(newFilteredDate)
  }

  const handleRightButtonClick = async () => {
    const nextDate = new Date(filteredDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const newFilteredDate = formatTimestamp(nextDate)
    setFilteredDate(newFilteredDate)
    await fetchRawData(newFilteredDate)
  }

  const fetchRawData = async (date) => {
    const apiUrl = `http://10.250.0.229:666/hris-api/raw/get?name=${text}&date=${date}`

    try {
      const response = await fetch(apiUrl)
      const status = response.status
      setResponseStatus(status)
      if (status === 200) {
        const retrievedData = await response.json()
        setData(retrievedData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleTextClick = () => {
    fetchRawData(filteredDate)
  }

  return (
    <group>
      <Text
        font="/mono.woff"
        fontSize={1}
        position={position}
        rotation={[0, 0, 0]}
        color={color}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
        onClick={handleTextClick}>
        {text}
      </Text>

      <Text
        fontSize={0.2}
        color={leftColor}
        position={[-1.5, 3, 2.8]}
        rotation={[0, 0, 0]}
        onPointerOver={() => setIsLeftHovered(true)}
        onPointerOut={() => setIsLeftHovered(false)}
        font="/Inter-Medium.woff"
        onClick={handleLeftButtonClick}>
        {'<<'}
      </Text>
      <Text
        fontSize={0.2}
        color={rightColor}
        position={[1.5, 3, 2.8]}
        rotation={[0, 0, 0]}
        onPointerOver={() => setIsRightHovered(true)}
        onPointerOut={() => setIsRightHovered(false)}
        font="/Inter-Medium.woff"
        onClick={handleRightButtonClick}>
        {'>>'}
      </Text>

      <DateText date={filteredDate} position={[0, 3, 2.8]} />
      {responseStatus === 200 && data.length > 0 && (
        <>
          <InteractiveTable data={data} />
          <TimeText position={[0, -1, 0]} rawData={data} />
          <ResultText position={[0, -2.8, 0]} rawData={data} />
        </>
      )}

      {responseStatus === 204 && text && (
        <>
          <NoDataText position={[0, -1, 0]} />
        </>
      )}
    </group>
  )
}

function NoDataText({ position }) {
  return (
    <Text font="/digital.woff" fontSize={5} position={position} rotation={[Math.PI / -2.1, 0, 0]} color="red" anchorX="center" anchorY="middle" textAlign="center">
      NO DATA
    </Text>
  )
}

function ResultText({ position, rawData }) {
  const now = new Date().toISOString().split('T')[0]
  const data = rawData[0]
  const rawTodayDate = formatDate(data.dateTime)

  const defaultWorkHour = data.defaultWorkHour
  const breakTime = data.breakTime
  const result = estimateFinishedWorkHour(rawData, defaultWorkHour, breakTime)
  if (rawTodayDate === now && result != '00:00') {
    return (
      <Text font="/Inter-Medium.woff" fontSize={0.2} position={position} color="rose" anchorX="center" anchorY="middle" textAlign="center">
        KAMU BISA PULANG PUKUL {result} ATAU LEBIH
      </Text>
    )
  } else {
    return null
  }
}

function TimeText({ position, rawData }) {
  let time = 0
  if (rawData.length > 0) {
    const breakTime = rawData[0].breakTime
    time = calculateTotalWorkHours(rawData, breakTime)
  }

  let color = time >= parseInt(rawData[0].defaultWorkHour) ? 'lime' : 'red'
  const formattedTotalHours = decimalToTime(time)
  return (
    <Text
      font="/digital.woff"
      fontSize={5}
      position={position}
      fillOpacity={0.9}
      rotation={[Math.PI / -2.1, 0, 0]}
      color={color}
      anchorX="center"
      anchorY="middle"
      textAlign="center">
      {formattedTotalHours}
    </Text>
  )
}

function ThreeDText({ position, text }) {
  return (
    <Text font="/Inter-Medium.woff" fontSize={0.7} position={position} rotation={[0, 0, 0]} color="wheat" anchorX="center" anchorY="middle" textAlign="center">
      {text}
    </Text>
  )
}

function DateText({ date, position }) {
  const formattedDate = formatDateToText(date)
  return (
    <Text font="/Inter-Medium.woff" fontSize={0.2} rotation={[0, 0, 0]} position={position}>
      {formattedDate}
    </Text>
  )
}

function TypeSomething({ position, text }) {
  if (!text || text === '') {
    return (
      <Text font="/Inter-Medium.woff" fontSize={0.8} position={position} rotation={[0, 0, 0]} color="gray">
        {'[Type Someone Name]'}
      </Text>
    )
  }
}

function InteractiveTable({ data }) {
  const tablePosition = [-15, 1 + data.length / 10, -5]
  const cellWidth = 1

  return (
    <group position={tablePosition} rotation={[0, 0, 0]}>
      <TableText position={[cellWidth * 10, 1, 0]} text="RFID Tag" />
      <TableText position={[cellWidth * 15, 1, 0]} text="Time" />
      <TableText position={[cellWidth * 20, 1, 0]} text="Type" />

      {data.map((row, index) => (
        <group key={index} position={[0, -index / 10, 0]}>
          <RowTableText position={[cellWidth * 10, -index / 2, 0]} text={row.rfidtag} />
          <RowTableText position={[cellWidth * 15, -index / 2, 0]} text={formatShortDate(row.dateTime)} />
          <RowTableText position={[cellWidth * 20, -index / 2, 0]} text={row.type} />
        </group>
      ))}
    </group>
  )
}

function RowTableText({ position, text }) {
  return (
    <Text font="/Inter-Medium.woff" fontSize={0.5} position={position} color="white" anchorX="center" anchorY="middle" textAlign="center">
      {text}
    </Text>
  )
}

function TableText({ position, text }) {
  return (
    <Text font="/Inter-Medium.woff" fontSize={0.5} position={position} color="#F89A36" anchorX="center" anchorY="middle" textAlign="center">
      {text}
    </Text>
  )
}
