
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canvas = document.querySelector('.webgl')

//This class contains the game logic
class MazeGame{
    constructor(){
        this.Init()
    }


    // Used for basic scene & other elements declaration
    Init(){


        //setup scene, camera & other elements
        this.scene = new THREE.Scene()
        // Set up blue sky
        this.scene.background = new THREE.Color(0x87CEEB); // Use a sky-blue color
        this.clock = new THREE.Clock()
        this.v = new THREE.Vector3()
        //define different camera views
        this.birdeyeView = new THREE.Vector3(0, 60, 50)
        this.closeupView = new THREE.Vector3(0, 5, 12)
        this.frontView = new THREE.Vector3(0,5,-14)
        this.sideView =new THREE.Vector3(6,7,0)
        this.camCounter=0;
        this.camViews= [this.birdeyeView,this.closeupView,this.sideView,this.frontView];

        this.oldElapsedTime = 0
        this.forwardVel = 0
        this.rightVel = 0
        this.objectsToUpdate = []

        //specify  current camera view point
        this.currentCam = this.birdeyeView
        this.keyMap = {}
        this.keyCameraMap={}
        this.thrusting = false
        this.bodyBool=false;
        this.maxSpeedForward=10.0;
        this.maxSpeedReverse=-5;
        this.tangible=true;
        this.headLights=true;
        this.flagWaveSpeed=2.0;

        //Initialize all the features using init methods
        this.InitTextures()
        this.InitCarControls()
        this.InitPhysics()
        //this.InitPhysicsDebugger()
        this.InitEnv()
        this.InitCamera()
        this.InitCar()
        //this.InitSound()
        this.InitMaze()
        this.InitLights()
        this.InitRenderer()
        this.InitControls()
        this.InitGuiControls()


        //Specify event listeners for user input
        window.addEventListener('resize', () => {
            this.Resize()
            this.renderer.render(this.scene, this.camera)
        })

        document.addEventListener('keydown', this.onDocumentKey, false)
        document.addEventListener('keyup', this.onDocumentKey, false)
        document.addEventListener('keyup', this.onCameraChange, false)
        document.addEventListener('contextmenu', event => event.preventDefault())
        this.Update()
    } // init close



    //Specify car controls for our scene
    InitCarControls(){
        this.onDocumentKey = (e) => {
            this.keyMap[e.key] = e.type === 'keydown'
        }
        this.onCameraChange =(e) =>{
            this.keyCameraMap[e.key] = e.type ==='keyup'
        }

    }


    //Specify textures for our scene elements
    InitTextures(){
        this.textureLoader = new THREE.TextureLoader()
        this.flagTexture=this.textureLoader.load('/flag/bulldog.png')
        this.champTexture = this.textureLoader.load('/champ/champions_logo.png');
        this.touchDownTexture=this.textureLoader.load('/touchdown/touchdown.jpg')
    }

    //Specify physics properties for our physics world
    InitPhysics(){
        this.world = new CANNON.World()
        this.world.gravity.set(0, -40, 0)
        this.defaultMaterial = new CANNON.Material('default')
        this.defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.1,
                restitution: 0.2
            }
        )
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true
        this.world.defaultContactMaterial = this.defaultContactMaterial
        this.world.addContactMaterial(this.defaultContactMaterial)
    }

    //Specify the local environment where the maze is placed
    InitEnv(){
        this.fog = new THREE.FogExp2(0x272640, 0.005)
        this.scene.fog = this.fog
        this.geometry = new THREE.PlaneBufferGeometry(1100, 1100, 2, 2)
        this.material = new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            side: THREE.DoubleSide
        })
        this.ground = new THREE.Mesh(this.geometry, this.material)
        this.scene.add(this.ground)
        this.ground.rotation.x = -Math.PI * 0.5
        this.ground.receiveShadow = true
        this.ground.castShadow=true
        this.floordefaultMaterial = new CANNON.Material('default')
        //physics
        this.groundBody = new CANNON.Body({
            mass: 0,
            material: this.floordefaultMaterial
        })
        this.world.addBody(this.groundBody)
        this.groundBody.addShape(new CANNON.Plane())
        this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)

        //Champions Poster plane
        this.champPlaneGeometry = new THREE.PlaneGeometry(100, 100);
        this.champMaterial = new THREE.MeshBasicMaterial({ map: this.champTexture });
        this.champPlane = new THREE.Mesh(this.champPlaneGeometry, this.champMaterial);
        this.champPlane.position.set(0,1,0);
        this.champPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this.champPlane);

        //TouchDown plane
        this.touchDownPlaneGeometry = new THREE.PlaneGeometry(40, 40);
        this.touchDownMaterial = new THREE.MeshBasicMaterial({ map: this.touchDownTexture });
        this.touchDownPlane = new THREE.Mesh(this.touchDownPlaneGeometry, this.touchDownMaterial);
        this.touchDownPlane.position.set(0,1,450);
        this.touchDownPlane.rotation.x = -Math.PI / 2;
        this.touchDownPlane.rotation.z = Math.PI;
        this.touchDownPlane.receiveShadow=true;
        this.touchDownPlane.castShadow=true;
        this.scene.add(this.touchDownPlane);

    }

    // Specify car structure & physics
    InitCar(){
        this.group = new THREE.Group()
        this.carRedMaterial = new THREE.MeshStandardMaterial({ color: 0x780000 })
        this.carWhiteMaterial = new THREE.MeshStandardMaterial({ color: '#808080' })
        this.box = new THREE.Mesh(new THREE.BoxBufferGeometry(5, 3, 8),  this.carRedMaterial)
        this.topBox = new THREE.Mesh(new THREE.BoxBufferGeometry( 5,  1,  4),  this.carWhiteMaterial)
        this.poleFront = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.3, 6.5), this.carRedMaterial)
        this.poleBack = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.3, 6.5),  this.carRedMaterial)
        this.flagPole =  new THREE.Mesh(new THREE.CylinderBufferGeometry(0.2, 0.2, 4),  this.carRedMaterial)



        //Specify flag structure, texture & material
        const flagGeometry  = new THREE.PlaneGeometry(2,1,32,32
        );
        const flagMaterial = new THREE.MeshLambertMaterial({
            color:"#FFFFFF",
            map: this.flagTexture,
            side:THREE.DoubleSide
        });
        this.flag = new THREE.Mesh(flagGeometry,flagMaterial);
        this.flagInitialPositions = this.flag.geometry.attributes.position.array.slice();
        this.group.add(this.poleFront)
        this.group.add(this.poleBack)
        this.group.add(this.box)
        this.group.add(this.topBox)
        this.group.add(this.flagPole)
        this.group.add(this.flag)
        this.topBox.position.set(0, 2, 2)
        this.flagPole.position.set(0,4,2)
        this.flag.position.set(1.2,5.5,2)
        this.poleFront.rotation.x = -Math.PI * 0.5
        this.poleFront.rotation.z = -Math.PI * 0.5
        this.poleFront.position.set(0.0, -0.5, -3.0)
        this.poleBack.rotation.x = -Math.PI * 0.5
        this.poleBack.rotation.z = -Math.PI * 0.5
        this.poleBack.position.set(0.0, -0.5, 3.0)

        this.scene.add(this.group)
        this.group.add(this.chaseCam)
        this.group.position.set(0, 0, 0)

        this.carBodyShape = new CANNON.Box(new CANNON.Vec3( 3, 0.75, 4.5))
        this.carBody = new CANNON.Body({
            mass: 40,
            material: this.defaultMaterial
        })
        //this.carBody.addShape(new CANNON.Sphere(2.5), new CANNON.Vec3(0, 1.8, 0))
        this.carBody.addShape(this.carBodyShape)
        this.world.addBody(this.carBody)
        
        this.carBody.position.copy(this.group.position)
        this.carBody.angularDamping = 0.9
        this.objectsToUpdate.push({
            mesh: this.group,
            body: this.carBody
        })
        this.carBody.allowSleep = false
        this.wheelGeometry = new THREE.CylinderBufferGeometry(0.99, 0.99, 0.6)
        this.wheelGeometry.rotateZ(Math.PI * 0.5)


        //Left Front Wheel
        this.wheelsFL = new THREE.Mesh(this.wheelGeometry,  this.carWhiteMaterial)
        this.scene.add(this.wheelsFL)
        this.wheelsFL.position.set(-3, 3, -1)
        this.wheelsFLShape = new CANNON.Sphere(0.4 * 3)
        this.wheelsFLBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsFLBody.allowSleep = false
        this.wheelsFLBody.addShape(this.wheelsFLShape)
        this.wheelsFLBody.position.copy(this.wheelsFL.position)
        this.world.addBody(this.wheelsFLBody)
        this.wheelsFLBody.angularDamping = 0.4
        this.wheelsFLBody.applyLocalForce = 20
        this.objectsToUpdate.push({
            mesh: this.wheelsFL,
            body: this.wheelsFLBody
        })
        
        
        //Right Front Wheel
        this.wheelsFR = new THREE.Mesh(this.wheelGeometry,  this.carWhiteMaterial)
        this.scene.add(this.wheelsFR)
        this.wheelsFR.position.set(3, 3, -1)
        this.wheelsFRShape = new CANNON.Sphere(0.4 * 3)
        this.wheelsFRBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsFRBody.addShape(this.wheelsFRShape)
        this.wheelsFRBody.position.copy(this.wheelsFR.position)
        this.world.addBody(this.wheelsFRBody)
        this.wheelsFRBody.allowSleep = false
        this.wheelsFRBody.angularDamping = 0.4
        this.wheelsFRBody.applyLocalForce = 20
        this.objectsToUpdate.push({
            mesh: this.wheelsFR,
            body: this.wheelsFRBody
        })

        //Left Back Wheel
        this.wheelsBL = new THREE.Mesh(this.wheelGeometry,  this.carWhiteMaterial)
        this.scene.add(this.wheelsBL)
        this.wheelsBL.position.set(-3, 3, 0.5)
        this.wheelsBLShape = new CANNON.Sphere(0.4 * 3)
        this.wheelsBLBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsBLBody.addShape(this.wheelsBLShape)
        this.wheelsBLBody.position.copy(this.wheelsBL.position)
        this.world.addBody(this.wheelsBLBody)
        this.wheelsBLBody.allowSleep = false
        this.wheelsBLBody.angularDamping = 0.4
        this.objectsToUpdate.push({
            mesh: this.wheelsBL,
            body: this.wheelsBLBody
        })

        //Right Back Wheel
        this.wheelsBR = new THREE.Mesh(this.wheelGeometry,  this.carWhiteMaterial)
        this.scene.add(this.wheelsBR)
        this.wheelsBR.position.set(3, 3, 0.5)
        this.wheelsBRShape = new CANNON.Sphere(0.4 * 3)
        this.wheelsBRBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsBRBody.addShape(this.wheelsBRShape)
        this.wheelsBRBody.position.copy(this.wheelsBR.position)
        this.world.addBody(this.wheelsBRBody)
        this.wheelsBRBody.allowSleep = false
        this.wheelsBRBody.angularDamping = 0.4
        this.objectsToUpdate.push({
            mesh: this.wheelsBR,
            body: this.wheelsBRBody
        })

        //constraints
        this.FLaxis = new CANNON.Vec3(1, 0, 0)
        this.FRaxis = new CANNON.Vec3(1, 0, 0)
        this.BLaxis = new CANNON.Vec3(1, 0, 0)
        this.BRaxis = new CANNON.Vec3(1, 0, 0)
        this.constraintFL = new CANNON.HingeConstraint(this.carBody, this.wheelsFLBody, {
            pivotA: new CANNON.Vec3(-3, -0.5, -3),
            axisA: this.FLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFL)

        this.constraintFR = new CANNON.HingeConstraint(this.carBody, this.wheelsFRBody, {
            pivotA: new CANNON.Vec3(3, -0.5, -3),
            axisA: this.FRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFR)

        this.constraintBL = new CANNON.HingeConstraint(this.carBody, this.wheelsBLBody, {
            pivotA: new CANNON.Vec3(-3, -0.5, 3),
            axisA: this.BLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBL)

        this.constraintBR = new CANNON.HingeConstraint(this.carBody, this.wheelsBRBody, {
            pivotA: new CANNON.Vec3(3, -0.5, 3),
            axisA: this.BRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBR)
        this.constraintBL.enableMotor()
        this.constraintBR.enableMotor()
    }


    //Specify maze structure, textures & physics
    InitMaze(){
        this.mazeMaterial = new THREE.MeshStandardMaterial({
            //side: THREE.DoubleSide
            color: '#BA0C2F'
        })
        this.gltfLoader = new GLTFLoader()
        this.gltfLoader.load(
            'maze2.glb',
            (gltf) => {
                //console.log(gltf)
                gltf.scene.scale.set(80, 50, 80)
                gltf.scene.position.set(0, -10, 0)
                gltf.scene.traverse((child) => {
                    if((child).isMesh){
                        this.gltfMesh = child
                        this.gltfMesh.receiveShadow = true
                        this.gltfMesh.castShadow = true
                        this.gltfMesh.material = this.mazeMaterial
                    }
                    
                })
                this.scene.add(gltf.scene)  
            }
        )

        //building physics
        this.buildingBody = new CANNON.Body({
            mass: 0,
            material: this.defaultMaterial
        })
        this.buildingShape = new CANNON.Box(new CANNON.Vec3(500, 25, 5))
        this.buildingBody.addShape(this.buildingShape)
        this.buildingBody.position.set(0, 18, 475)
        this.world.addBody(this.buildingBody)
       //borders
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 25, 500)), new CANNON.Vec3(-475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 25, 500)), new CANNON.Vec3(475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(500, 25, 5)), new CANNON.Vec3(0, 0, -950))

        //horizontal
        //r1
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.5 , 20, 5)), new CANNON.Vec3(-365, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/1.7 , 20, 5)), new CANNON.Vec3(-225, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.65 , 20, 5)), new CANNON.Vec3(-90, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.60 , 20, 5)), new CANNON.Vec3(225, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 , 20, 5)), new CANNON.Vec3(390, 0, -43))

        //r2
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.5, 20, 5)), new CANNON.Vec3(-458, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-270, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-180, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 2, 20, 5)), new CANNON.Vec3(-70, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(90, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(270, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(410, 0, -43.3 * 2))

        //r3
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 4.0, 20, 5)), new CANNON.Vec3(-390, 0, -45.3 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-228, 0, -44.9 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 2, 20, 5)), new CANNON.Vec3(25, 0, -44.9 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 4.85, 20, 5)), new CANNON.Vec3(272, 0, -44.5 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(452, 0, -44.9 * 3))

        //r4
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(-295, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(-182, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(-45, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 6.72, 20, 4.5)), new CANNON.Vec3(180, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(408, 0, -44.8 * 4))

        //r5
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(-386, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80, 20, 4.5)), new CANNON.Vec3(-270, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 4.5)), new CANNON.Vec3(-92, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80, 20, 4.5)), new CANNON.Vec3(45, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(295, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(408, 0, -44.8 * 5))

        //r6
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-318, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(-182, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-45, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(135, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.92 * 4, 20, 5)), new CANNON.Vec3(340, 0, -44.8 * 6))

        //r7
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(-275, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(-90, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(452, 0, -45 * 7))

        //r8
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.84 * 2, 20, 5)), new CANNON.Vec3(-296, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(318, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45 * 8))

        //r9
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-364, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-272, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.7, 20, 5)), new CANNON.Vec3(-184, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(250, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45 * 9))

        //r10
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.88 * 3, 20, 5)), new CANNON.Vec3(-364, 0, -45 * 10))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/1.88 * 4, 20, 5)), new CANNON.Vec3(340, 0, -45 * 10))

        //r11
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.87 * 3, 20, 5)), new CANNON.Vec3(-319, 0, -45 * 11))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(205, 0, -45 * 11))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 2.0 * 3, 20, 5)), new CANNON.Vec3(368, 0, -45 * 11))

        //r12
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-228, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45 * 12))

        //r13
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.75 * 2, 20, 5)), new CANNON.Vec3(-295, 0, -45.2 * 13))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-185, 0, -45.2 * 13))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.75 * 2, 20, 5)), new CANNON.Vec3(385, 0, -45.2 * 13))


        //r14
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.87 * 3, 20, 5)), new CANNON.Vec3(-364, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-228, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 8, 20, 5)), new CANNON.Vec3(21, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(318, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45.2 * 14))

        //r15
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-275, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-185, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-25, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(180, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45.2 * 15))

        //r16
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-320, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 10, 20, 5)), new CANNON.Vec3(-23, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(294, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(455, 0, -45.2 * 16))

        //r17
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.9 * 4, 20, 5)), new CANNON.Vec3(-295, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-137, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(340, 0, -45.2 * 17))

        //r18
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 5, 20, 5)), new CANNON.Vec3(-321, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-22, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(135, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45.2 * 18))

        //r19
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-320, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 4, 20, 5)), new CANNON.Vec3(-115, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(68, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(205, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(453, 0, -45.2 * 19))

        //r20
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-365, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-250, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-135, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-45, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.86 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.86 * 4, 20, 5)), new CANNON.Vec3(340, 0, -45.2 * 20))

        //vertical
        //c1
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + 43, 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + 43, 0, -270))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4 / 1.88)), new CANNON.Vec3(-475 + 43, 0, -451))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.9)), new CANNON.Vec3(-475 + 43, 0, -614))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + 43, 0, -768))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.9)), new CANNON.Vec3(-475 + 43, 0, -885))

        //c2
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -202))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/1.8)), new CANNON.Vec3(-475 + (44 * 2), 0, -315))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/1.85)), new CANNON.Vec3(-475 + (44 * 2), 0, -563))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -700))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/1.85)), new CANNON.Vec3(-475 + (44 * 2), 0, -888))

        //c3
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -110))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -290))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -383))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -560))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3 / 1.85)), new CANNON.Vec3(-475 + (44 * 3), 0, -700))

        //c4
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -245))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -429))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -520))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -882))

        //c5
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -133))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -384))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4 / 1.9)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -632))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -835))

        //c6
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -225))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -360))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -495))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -745))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -882))

        //c7
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -155))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 7/ 1.75)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -490))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.75)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -815))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -928))

        //c8
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/ 1.9)), new CANNON.Vec3(-475 + (45 * 8), 0, -155))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -292))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -700))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -792))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -882))

        //c9
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -110))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -246))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -656))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -790))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -925))

        //c10
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -178))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -290))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -745))

        //c11
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/ 1.9)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -245))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -814))

        //c12
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -88))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -248))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -678))

        //c13
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -178))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -838))

        //c14
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -88))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -248))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 7/ 2.0)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -883))

        //c15
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4/ 1.9)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -361))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -587))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -769))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -930))

        //c16
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -316))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 6/ 1.9)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -585))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -788))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -885))

        //c17
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -380))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -634))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -838))

        //c18
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -42))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -385))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -587))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -698))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -788))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -885))

        //c19
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 19), 0, -107))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 19), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -360))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -722))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -860))

        //c20
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 20), 0, -292))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 20), 0, -478))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -610))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -768))

    }

    InitGuiControls(){
        // Create a GUI
        let gui = new dat.GUI();
        var self = this;

        // Add a folder for Car settings
        let carFolder = gui.addFolder('Vehicle Settings');
        // Add a controller for max speed
        let maxController =carFolder.add({ maxSpeed: this.maxSpeedForward }, 'maxSpeed', 0, 30).step(0.1).name('Max Speed');
        maxController.onChange(function(value) {
            console.log('New Restitution Value:', value);
            self.maxSpeedForward=value;
            console.log(self.maxSpeedForward)
        });

        let flagController =carFolder.add({ flagSpeed: this.flagWaveSpeed }, 'flagSpeed', 1, 5).step(0.5).name('flag W speed');
        flagController.onChange(function(value) {
            console.log('New Restitution Value:', value);
            self.flagWaveSpeed=value;
            console.log(self.maxSpeedForward)
        });

        //flag Speed Controller

        //Headlight controller
        const headLightController = carFolder.add({ headLights: this.headLights }, 'headLights').name('headLights');
        headLightController.onChange(function(value) {
            if(!value){
                self.headLight.visible=false;
                self.headLight2.visible=false;
            }else{
                self.headLight.visible=true;
                self.headLight2.visible=true;
            }
        });

        // Add a folder for material settings
        let wallFolder = gui.addFolder('Wall Settings');
        let restitutionController = wallFolder.add(this.defaultMaterial, 'restitution', 0, 2).step(0.01).name('Bounciness').setValue(0.2);
        restitutionController.onChange(function(value) {
            console.log('New Restitution Value:', value);
        });

        // Add a controller for tangibility checkbox
        const tangibilityController = wallFolder.add({ tangibility: this.tangible }, 'tangibility').name('Tangibility');
        tangibilityController.onChange(function(value) {
            // Update the car's tangibility value
            if(!value){
                self.world.removeBody(self.buildingBody)
            }else{
                self.world.addBody(self.buildingBody)
            }
            console.log('New Tangibility Value:', value);
        });

    }


    //Specify renderer properties
    InitRenderer(){
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
        })
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.render(this.scene, this.camera)
    }

    //Specify default camera basic information & location
    InitCamera(){
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000)
        this.camera.position.set(0, 100, 0 )
        this.scene.add(this.camera)
        this.chaseCam = new THREE.Object3D()
        this.chaseCam.position.set(0, 0, 0)
        this.chaseCamPivot = new THREE.Object3D()
        this.chaseCamPivot.position.copy(this.currentCam)
        this.chaseCam.add(this.chaseCamPivot)
    }




    //Specify lights to illuminate up the scene
    InitLights(){
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
        this.scene.add(this.ambientLight)
        this.pointLight = new THREE.PointLight(0xffffff, 1.8)
        this.scene.add(this.pointLight)

        this.pointLight.position.set(0, 300, 0)
        this.pointLight.castShadow = false

        //Headlight for the bulldog vehicle
        this.headLight = new THREE.PointLight(0xffffff, 1.5,30, 1)
        this.headLight2 = new THREE.PointLight(0xffffff, 1.5,30, 1)

        this.headLight.position.set(-1.5, 0.5,-10)
        this.headLight2.position.set(1.5, 0.5,-10)
        
        this.group.add(this.headLight)
        this.group.add(this.headLight2)
        this.headLight.rotation.x = Math.PI * 0.5

        //Blinking red light for touchdown
        this.redLight = new THREE.PointLight(0xff0000,10.0,30,1);
        this.redLight.position.set(0, 15, 450);

    }

    //Specify orbital controls
    InitControls(){
        this.controls = new OrbitControls(this.camera, canvas)
        this.controls.enableDamping = true
    }

    Resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    //Specify animation function
    Update(){
        requestAnimationFrame(() => {
            this.elapsedTime = this.clock.getElapsedTime()
            this.deltaTime = this.elapsedTime - this.oldElapsedTime
            this.oldElapsedTime = this.elapsedTime
            this.world.step(1/60, this.oldElapsedTime, 3)

            this.camera.lookAt(this.group.position)

            this.chaseCamPivot.getWorldPosition(this.v)
            if (this.v.y < 1){
                this.v.y = 1
            }
            this.camera.position.lerpVectors(this.camera.position, this.v, 0.1)

            for(this.object of this.objectsToUpdate){
                this.object.mesh.position.copy(this.object.body.position)
                this.object.mesh.quaternion.copy(this.object.body.quaternion)
            }


            this.thrusting = false

            if (this.keyMap['w']|| this.keyMap['ArrowUp']){
                if(this.forwardVel < this.maxSpeedForward){
                    this.forwardVel += 0.5
                    this.thrusting = true
                } 
            }

            if (this.keyMap['s'] || this.keyMap['ArrowDown']){
                if(this.forwardVel > this.maxSpeedReverse){
                    this.forwardVel -= 1
                    this.thrusting = true 
                } 
            }

            if (this.keyMap['a'] || this.keyMap['ArrowLeft']){
                if(this.rightVel > -0.5){
                    this.rightVel -= 0.025
                } 
            }

            if (this.keyMap['d'] || this.keyMap['ArrowRight']){
                if(this.rightVel < 0.5){
                    this.rightVel += 0.025
                } 
            }
            if (this.keyMap[' ']){
                if(this.forwardVel > 0){
                    this.forwardVel -= 1
                }
                if(this.forwardVel < 0){
                    this.forwardVel += 1
                }
            }

            if (!this.thrusting || !this.getPos){
                if (this.forwardVel > 0){
                    this.forwardVel -= 0.25
                }
                if(this.forwardVel < 0){
                    this.forwardVel += 0.25
                }
                if(this.rightVel > 0){
                    this.rightVel -= 0.01
                }
                if(this.rightVel < 0){
                    this.rightVel += 0.01
                }
            }

            if (this.keyCameraMap['c']){
                this.chaseCamPivot.position.copy(this.camViews[this.camCounter]);
                if(this.camCounter!==3) {
                    this.camCounter++;
                    this.currentCam = this.camViews[this.camCounter];
                }else{
                    this.camCounter=0;
                    this.currentCam=this.camViews[this.camCounter];
                }
                this.keyCameraMap={}
            }

            if(this.keyCameraMap['t']){
                if(!this.bodyBool){
                    this.world.removeBody(this.buildingBody)
                    this.bodyBool=true;
                }else{
                    this.world.addBody(this.buildingBody)
                    this.bodyBool=false;
                }

                 this.keyCameraMap={};

            }


            this.constraintBL.setMotorSpeed(this.forwardVel)
            this.constraintBR.setMotorSpeed(this.forwardVel)
            this.constraintFL.axisA.z = this.rightVel
            this.constraintFR.axisA.z = this.rightVel

            //flag movement
            const t = this.clock.getElapsedTime() * 1.5;
            const positions = this.flag.geometry.attributes.position.array;
            const waveFrequency = 2.5; // Increase for more folds

            for (let i = 0; i < positions.length; i += 3) {
                const z =this.flagInitialPositions[i+2];
                const y = this.flagInitialPositions[i + 1];
                const x = this.flagInitialPositions[i];

                if(x>-1){
                    positions[i+2] = z + Math.sin(x * waveFrequency + this.flagWaveSpeed * t) *0.5;
                }
                //positions[i+1] = y + Math.sin(x + t) *0.5;
            }

            this.flag.geometry.attributes.position.needsUpdate = true;

            //Winning Light
            // //Check cube is within the specified winning range
            if (
                this.group.position.x >= -20 && this.group.position.x <= 20 &&
                this.group.position.z >= 430 && this.group.position.z <= 470
            ) {
                this.scene.add(this.redLight);
                this.redLight.intensity = Math.abs(Math.sin(Date.now() * 0.002)) * 5;
            }else{
                this.redLight.intensity=0;
            }

            this.renderer.render(this.scene, this.camera)
            this.Update()
        })  
    }
}

window.addEventListener('DOMContentLoaded', () => {
   let obj = new MazeGame()
})

